"""
Tests for api/sla.py.

SLA targets are only ever read from the persisted `sla_hours` and
`sla_due_at` fields. Complaints without them must be reported as
unavailable, never estimated.
"""

import pytest

from api.tests.analytics_fixtures import (
    NOW,
    days_ago,
    hours_ago,
    install_memory_database,
    make_complaint,
)

import api.management as management
import api.sla as sla


def test_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = sla.get_sla_status()

    assert result["total_complaints"] == 0
    assert result["with_sla_target"] == 0
    assert result["without_sla_target"] == 0
    assert result["coverage_percent"] is None
    assert result["compliance_percent"] is None
    assert result["state_distribution"] == {}
    assert result["attention"] == []


def test_complaints_without_sla_data_are_unavailable(monkeypatch):
    legacy_open = make_complaint(status="Assigned")
    legacy_closed = make_complaint(
        status="Closed",
        resolved_at=hours_ago(1),
    )

    install_memory_database(
        monkeypatch,
        documents={"complaints": [legacy_open, legacy_closed]},
    )

    result = sla.get_sla_status()

    assert result["total_complaints"] == 2
    assert result["with_sla_target"] == 0
    assert result["without_sla_target"] == 2
    assert result["coverage_percent"] == 0.0
    assert result["unavailable"] == 2
    assert result["met"] == 0
    assert result["breached"] == 0
    assert result["compliance_percent"] is None


def test_states_are_derived_from_persisted_targets(monkeypatch):
    met = make_complaint(
        status="Closed",
        created_at=hours_ago(30),
        resolved_at=hours_ago(10),
        closed_at=hours_ago(10),
        priority="Medium",
        sla_hours=24,
        sla_due_at=hours_ago(6),
    )
    breached_resolved = make_complaint(
        status="Closed",
        created_at=days_ago(4),
        resolved_at=hours_ago(2),
        closed_at=hours_ago(2),
        priority="High",
        sla_hours=24,
        sla_due_at=days_ago(3),
    )
    breached_open = make_complaint(
        status="In Progress",
        created_at=days_ago(3),
        priority="High",
        sla_hours=24,
        sla_due_at=days_ago(2),
    )
    at_risk = make_complaint(
        status="Assigned",
        created_at=hours_ago(22),
        priority="Critical",
        sla_hours=24,
        sla_due_at=hours_ago(-2),
    )
    on_track = make_complaint(
        status="Assigned",
        created_at=hours_ago(2),
        priority="Standard",
        sla_hours=48,
        sla_due_at=hours_ago(-46),
    )

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [
                met,
                breached_resolved,
                breached_open,
                at_risk,
                on_track,
            ]
        },
    )

    result = sla.get_sla_status()

    assert result["with_sla_target"] == 5
    assert result["without_sla_target"] == 0
    assert result["met"] == 1
    assert result["breached"] == 2
    assert result["at_risk"] == 1
    assert result["on_track"] == 1
    assert result["compliance_percent"] == pytest.approx(
        33.33,
        abs=0.01,
    )

    # Only unresolved breached / at-risk cases need attention.
    attention_ids = {row["id"] for row in result["attention"]}
    assert str(breached_open["_id"]) in attention_ids
    assert str(met["_id"]) not in attention_ids
    assert str(breached_resolved["_id"]) not in attention_ids

    for row in result["attention"]:
        assert row["sla_hours"] is not None
        assert row["sla_due_at"] is not None
        assert row["hours_remaining"] is not None


def test_at_risk_uses_the_declared_threshold(monkeypatch):
    # 20% of a 10 hour window is 2 hours: 1 hour left -> at risk.
    at_risk = make_complaint(
        status="Assigned",
        created_at=hours_ago(9),
        sla_hours=10,
        sla_due_at=hours_ago(-1),
    )
    # 5 hours left of a 10 hour window -> on track.
    on_track = make_complaint(
        status="Assigned",
        created_at=hours_ago(5),
        sla_hours=10,
        sla_due_at=hours_ago(-5),
    )

    install_memory_database(
        monkeypatch,
        documents={"complaints": [at_risk, on_track]},
    )

    result = sla.get_sla_status()

    assert result["at_risk_threshold_ratio"] == 0.2
    assert result["at_risk"] == 1
    assert result["on_track"] == 1


def test_department_and_priority_breakdowns(monkeypatch):
    billing_breached = make_complaint(
        department="Billing",
        status="In Progress",
        created_at=days_ago(3),
        priority="High",
        sla_hours=24,
        sla_due_at=days_ago(2),
    )
    billing_met = make_complaint(
        department="Billing",
        status="Closed",
        created_at=hours_ago(20),
        resolved_at=hours_ago(15),
        sla_hours=24,
        priority="Medium",
        sla_due_at=hours_ago(-4),
    )
    logistics_legacy = make_complaint(
        department="Logistics",
        status="Assigned",
    )

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [
                billing_breached,
                billing_met,
                logistics_legacy,
            ]
        },
    )

    result = sla.get_sla_status()

    departments = {
        row["department"]: row for row in result["departments"]
    }

    assert departments["Billing"]["total"] == 2
    assert departments["Billing"]["Breached"] == 1
    assert departments["Billing"]["Met"] == 1
    assert departments["Logistics"]["Unavailable"] == 1

    priorities = {
        row["priority"]: row for row in result["priorities"]
    }
    assert priorities["High"]["Breached"] == 1
    assert priorities["Medium"]["Met"] == 1
    # Legacy complaints are excluded from priority SLA rows.
    assert "Not recorded" not in priorities


def test_build_sla_fields_only_writes_real_targets():
    created_at = NOW

    fields = sla.build_sla_fields(created_at=created_at, sla_hours=24)
    assert fields["sla_hours"] == 24.0
    assert fields["sla_due_at"] > created_at

    assert sla.build_sla_fields(
        created_at=created_at,
        sla_hours=None,
    ) == {}
    assert sla.build_sla_fields(
        created_at=created_at,
        sla_hours=0,
    ) == {}
    assert sla.build_sla_fields(
        created_at=created_at,
        sla_hours="not-a-number",
    ) == {}
    assert sla.build_sla_fields(created_at=None, sla_hours=12) == {}


def test_management_sla_overview_exposes_targets(monkeypatch):
    tracked = make_complaint(
        status="In Progress",
        created_at=days_ago(3),
        priority="High",
        sla_hours=24,
        sla_due_at=days_ago(2),
    )
    legacy = make_complaint(status="Assigned")

    install_memory_database(
        monkeypatch,
        documents={"complaints": [tracked, legacy]},
    )

    overview = management.get_sla_overview()

    # Existing keys are preserved.
    assert overview["total_complaints"] == 2
    assert overview["resolved_complaints"] == 0
    assert overview["open_complaints"] == 2

    # New, real SLA keys.
    assert overview["with_sla_target"] == 1
    assert overview["without_sla_target"] == 1
    assert overview["breached"] == 1
    assert overview["at_risk_threshold_ratio"] == 0.2
    assert len(overview["attention"]) == 1
