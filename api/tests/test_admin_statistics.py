"""
Tests for admin statistics, audit log pagination/filtering and
the audit activity summary.
"""

from api.tests.analytics_fixtures import (
    days_ago,
    hours_ago,
    install_memory_database,
    make_analysis,
    make_audit_log,
    make_complaint,
    make_user,
)

import api.management as management


# ============================================================
# ADMIN STATISTICS
# ============================================================

def test_admin_statistics_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = management.get_admin_statistics()

    assert result["complaints"]["total"] == 0
    assert result["complaints"]["status_distribution"] == {}
    assert result["users"]["total"] == 0
    assert result["users"]["role_distribution"] == {}
    assert result["users"]["departments"] == []
    assert result["audit"]["total_logs"] == 0
    assert result["audit"]["action_distribution"] == {}
    assert result["validation"]["analyzed_complaints"] == 0
    assert result["resolution"]["average_resolution_hours"] is None


def test_admin_statistics_full_dataset(monkeypatch):
    open_complaint = make_complaint(
        status="Assigned",
        department="Billing",
        created_at=days_ago(2),
    )
    closed_complaint = make_complaint(
        status="Closed",
        department="Billing",
        created_at=hours_ago(20),
        resolved_at=hours_ago(10),
        closed_at=hours_ago(10),
    )
    escalated = make_complaint(
        status="Escalated",
        department="Logistics",
        created_at=days_ago(4),
    )
    in_review = make_complaint(
        status="Manual Review",
        department="Support",
        manual_review_required=True,
        review_status="Pending",
        created_at=days_ago(1),
    )

    users = [
        make_user(role="Admin", email="admin@example.com"),
        make_user(role="Manager", email="manager@example.com"),
        make_user(
            role="Agent",
            email="agent@example.com",
            department="Logistics",
        ),
        make_user(
            role="Agent",
            email="agent2@example.com",
            status="Inactive",
        ),
        make_user(role="Customer", email="customer@example.com", department=None),
    ]

    logs = [
        make_audit_log(action="Complaint created", actor_role="Customer"),
        make_audit_log(action="Complaint created", actor_role="Customer"),
        make_audit_log(action="Review: Approve", actor_role="Reviewer"),
        make_audit_log(
            action="User status updated",
            actor_role="Admin",
            entity_type="user",
        ),
    ]

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [
                open_complaint,
                closed_complaint,
                escalated,
                in_review,
            ],
            "analyses": [
                make_analysis(open_complaint["_id"]),
                make_analysis(closed_complaint["_id"]),
            ],
            "users": users,
            "audit_logs": logs,
        },
    )

    result = management.get_admin_statistics()

    complaints = result["complaints"]
    assert complaints["total"] == 4
    assert complaints["analyzed"] == 2
    assert complaints["without_analysis"] == 2
    assert complaints["open"] == 3
    assert complaints["resolved"] == 1
    assert complaints["closed"] == 1
    assert complaints["escalated"] == 1
    assert complaints["manual_review"] == 1
    assert complaints["department_distribution"]["Billing"] == 2

    assert result["resolution"]["average_resolution_hours"] == 10.0
    assert result["resolution"]["resolution_rate_percent"] == 25.0

    assert result["users"]["total"] == 5
    assert result["users"]["role_distribution"] == {
        "Admin": 1,
        "Manager": 1,
        "Agent": 2,
        "Customer": 1,
    }
    assert result["users"]["status_distribution"] == {
        "Active": 4,
        "Inactive": 1,
    }
    assert result["users"]["departments"] == ["Billing", "Logistics"]

    audit = result["audit"]
    assert audit["total_logs"] == 4
    assert audit["logs_in_window"] == 4
    assert audit["action_distribution"]["Complaint created"] == 2
    assert audit["actor_role_distribution"]["Customer"] == 2
    assert audit["entity_type_distribution"]["complaint"] == 3
    assert audit["last_activity_at"] is not None


# ============================================================
# AUDIT SUMMARY
# ============================================================

def test_audit_summary_window_and_series(monkeypatch):
    logs = [
        make_audit_log(created_at=hours_ago(2)),
        make_audit_log(created_at=hours_ago(3)),
        make_audit_log(created_at=days_ago(2)),
        make_audit_log(created_at=days_ago(40)),
    ]

    install_memory_database(
        monkeypatch,
        documents={"audit_logs": logs},
    )

    result = management.get_audit_summary(days=7)

    assert result["days"] == 7
    assert result["total_logs"] == 4
    assert result["logs_in_window"] == 3
    assert len(result["daily_activity"]) == 7
    assert sum(
        point["count"] for point in result["daily_activity"]
    ) == 3


def test_audit_summary_resolves_actor_names(monkeypatch):
    user = make_user(name="Alice Admin", role="Admin")

    logs = [
        make_audit_log(actor_id=str(user["_id"]), actor_role="Admin"),
        make_audit_log(actor_id=str(user["_id"]), actor_role="Admin"),
        make_audit_log(actor_id="not-an-object-id", actor_role="Agent"),
    ]

    install_memory_database(
        monkeypatch,
        documents={"users": [user], "audit_logs": logs},
    )

    result = management.get_audit_summary(days=30)

    top = {row["actor_id"]: row for row in result["top_actors"]}
    assert top[str(user["_id"])]["actor_name"] == "Alice Admin"
    assert top[str(user["_id"])]["actions"] == 2
    # Unknown actors are reported without an invented name.
    assert top["not-an-object-id"]["actor_name"] is None


def test_audit_summary_clamps_window(monkeypatch):
    install_memory_database(monkeypatch)

    assert management.get_audit_summary(days=0)["days"] == 1
    assert management.get_audit_summary(days=9999)["days"] == 365


# ============================================================
# AUDIT LOG LISTING
# ============================================================

def build_audit_dataset():
    user = make_user(name="Alice Admin", role="Admin")

    logs = [
        make_audit_log(
            actor_id=str(user["_id"]),
            actor_role="Admin",
            action="User status updated",
            entity_type="user",
            entity_id="user-9",
            created_at=hours_ago(1),
        ),
        make_audit_log(
            actor_id="agent-1",
            actor_role="Agent",
            action="Agent: Started handling",
            entity_id="complaint-1",
            created_at=hours_ago(5),
        ),
        make_audit_log(
            actor_id="agent-1",
            actor_role="Agent",
            action="Agent: Complaint resolved",
            entity_id="complaint-1",
            created_at=hours_ago(4),
        ),
        make_audit_log(
            actor_id="reviewer-1",
            actor_role="Reviewer",
            action="Review: Approve",
            entity_id="complaint-2",
            created_at=days_ago(3),
        ),
        make_audit_log(
            actor_id="customer-1",
            actor_role="Customer",
            action="Complaint created",
            entity_id="complaint-3",
            created_at=days_ago(10),
        ),
    ]

    return {"users": [user], "audit_logs": logs}


def test_audit_logs_pagination(monkeypatch):
    install_memory_database(monkeypatch, documents=build_audit_dataset())

    first = management.get_audit_logs(limit=2, page=1)

    assert first["total"] == 5
    assert first["count"] == 2
    assert first["pages"] == 3
    assert first["has_more"] is True
    assert first["result_filter_available"] is False

    second = management.get_audit_logs(limit=2, page=2)
    assert second["count"] == 2
    assert second["page"] == 2

    third = management.get_audit_logs(limit=2, page=3)
    assert third["count"] == 1
    assert third["has_more"] is False

    # Newest first, no overlap between pages.
    ids = [row["id"] for row in first["logs"] + second["logs"]]
    assert len(set(ids)) == 4


def test_audit_logs_filters(monkeypatch):
    install_memory_database(monkeypatch, documents=build_audit_dataset())

    by_role = management.get_audit_logs(actor_role="Agent")
    assert by_role["total"] == 2

    by_actor = management.get_audit_logs(actor_id="reviewer-1")
    assert by_actor["total"] == 1

    by_action = management.get_audit_logs(action="Complaint created")
    assert by_action["total"] == 1

    by_entity = management.get_audit_logs(entity_type="user")
    assert by_entity["total"] == 1

    by_search = management.get_audit_logs(search="review")
    assert by_search["total"] == 1

    combined = management.get_audit_logs(
        actor_role="Agent",
        search="resolved",
    )
    assert combined["total"] == 1


def test_audit_logs_date_range(monkeypatch):
    install_memory_database(monkeypatch, documents=build_audit_dataset())

    recent = management.get_audit_logs(
        date_from=days_ago(1).strftime("%Y-%m-%d"),
    )
    assert recent["total"] == 3

    old = management.get_audit_logs(
        date_to=days_ago(5).strftime("%Y-%m-%d"),
    )
    assert old["total"] == 1

    invalid = management.get_audit_logs(date_from="not-a-date")
    assert invalid["total"] == 5


def test_audit_logs_resolve_actor_names_and_facets(monkeypatch):
    install_memory_database(monkeypatch, documents=build_audit_dataset())

    result = management.get_audit_logs(limit=10)

    admin_rows = [
        row for row in result["logs"] if row["actor_role"] == "Admin"
    ]
    assert admin_rows[0]["actor_name"] == "Alice Admin"

    agent_rows = [
        row for row in result["logs"] if row["actor_role"] == "Agent"
    ]
    assert agent_rows[0]["actor_name"] is None

    assert "Review: Approve" in result["available_actions"]
    assert "Agent" in result["available_roles"]
    assert set(result["available_entity_types"]) == {
        "complaint",
        "user",
    }


def test_audit_logs_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = management.get_audit_logs()

    assert result["total"] == 0
    assert result["pages"] == 0
    assert result["logs"] == []
    assert result["available_actions"] == []


# ============================================================
# ESCALATIONS
# ============================================================

def test_escalations_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = management.get_escalated_complaints()

    assert result["count"] == 0
    assert result["escalations"] == []
    assert result["statistics"]["currently_escalated"] == 0
    assert result["statistics"]["ever_escalated"] == 0
    assert result["statistics"]["average_hours_since_escalation"] is None


def test_escalations_include_real_context(monkeypatch):
    from api.tests.analytics_fixtures import make_activity

    escalated = make_complaint(
        status="Escalated",
        department="Logistics",
        created_at=days_ago(3),
    )
    escalated_no_event = make_complaint(
        status="Escalated",
        department="Billing",
        created_at=days_ago(5),
    )
    resolved_after = make_complaint(
        status="Closed",
        department="Logistics",
        created_at=days_ago(6),
        resolved_at=days_ago(1),
        closed_at=days_ago(1),
    )

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [
                escalated,
                escalated_no_event,
                resolved_after,
            ],
            "analyses": [
                make_analysis(
                    escalated["_id"],
                    category="Delivery & Logistics",
                    escalation_required=True,
                    escalation_level="Critical",
                    escalation_reason="Repeated delivery failure",
                ),
            ],
            "complaint_activity": [
                make_activity(
                    escalated["_id"],
                    activity_type="escalated",
                    title="Escalated",
                    timestamp=hours_ago(12),
                    actor="Adam Agent",
                    actor_role="Agent",
                ),
                make_activity(
                    resolved_after["_id"],
                    activity_type="escalated",
                    title="Escalated",
                    timestamp=days_ago(4),
                ),
            ],
        },
    )

    result = management.get_escalated_complaints()

    assert result["count"] == 2

    rows = {row["title"]: row for row in result["escalations"]}
    first = result["escalations"][0]
    assert set(rows) == {"Complaint"}  # same title in fixtures
    assert first["status"] == "Escalated"

    with_context = [
        row
        for row in result["escalations"]
        if row["escalation_level"] == "Critical"
    ][0]
    assert with_context["escalation_reason"] == (
        "Repeated delivery failure"
    )
    assert with_context["category"] == "Delivery & Logistics"
    assert with_context["escalated_by"] == "Adam Agent"
    assert with_context["hours_since_escalation"] == pytest_approx(12)

    without_context = [
        row
        for row in result["escalations"]
        if row["escalation_level"] is None
    ][0]
    assert without_context["escalated_at"] is None
    assert without_context["hours_since_escalation"] is None

    statistics = result["statistics"]
    assert statistics["currently_escalated"] == 2
    assert statistics["ever_escalated"] == 2
    assert statistics["resolved_after_escalation"] == 1
    assert statistics["level_distribution"] == {
        "Critical": 1,
        "Not recorded": 1,
    }
    assert statistics["department_distribution"] == {
        "Billing": 1,
        "Logistics": 1,
    }
    assert statistics["reason_distribution"] == {
        "Repeated delivery failure": 1
    }
    assert statistics["escalation_time_unavailable"] == 1


def pytest_approx(value):
    import pytest

    return pytest.approx(value, abs=0.1)


# ============================================================
# MANAGEMENT COMPLAINT FILTERING (server side)
# ============================================================

def build_filter_dataset():
    from api.tests.analytics_fixtures import make_analysis

    billing = make_complaint(
        title="Duplicate charge on my card",
        department="Billing",
        status="Assigned",
        assigned_to="agent-1",
        priority="High",
        created_at=days_ago(1),
    )
    logistics = make_complaint(
        title="Parcel never arrived",
        department="Logistics",
        status="Escalated",
        assigned_to="agent-2",
        priority="Critical",
        created_at=days_ago(5),
    )
    support = make_complaint(
        title="Rude agent on chat",
        department="Support",
        status="Closed",
        assigned_to="agent-1",
        created_at=days_ago(20),
        resolved_at=days_ago(19),
    )

    return {
        "complaints": [billing, logistics, support],
        "analyses": [
            make_analysis(billing["_id"]),
            make_analysis(
                logistics["_id"],
                category="Delivery & Logistics",
                department="Logistics",
            ),
            make_analysis(
                support["_id"],
                category="Service Quality",
                department="Support",
            ),
        ],
    }


def test_management_complaints_unfiltered(monkeypatch):
    install_memory_database(monkeypatch, documents=build_filter_dataset())

    result = management.get_management_complaints()

    assert result["total"] == 3
    assert result["count"] == 3
    assert result["page"] == 1
    assert result["pages"] == 1
    assert result["has_more"] is False
    assert set(result["available_departments"]) == {
        "Billing",
        "Logistics",
        "Support",
    }
    assert "Delivery & Logistics" in result["available_categories"]
    assert result["available_priorities"] == ["Critical", "High"]

    first = result["complaints"][0]
    assert first["category"] is not None
    assert "id" in first and "status" in first


def test_management_complaints_filters(monkeypatch):
    install_memory_database(monkeypatch, documents=build_filter_dataset())

    assert management.get_management_complaints(
        status="Escalated"
    )["total"] == 1

    assert management.get_management_complaints(
        department="Billing"
    )["total"] == 1

    assert management.get_management_complaints(
        assigned_to="agent-1"
    )["total"] == 2

    assert management.get_management_complaints(
        priority="Critical"
    )["total"] == 1

    assert management.get_management_complaints(
        category="Service Quality"
    )["total"] == 1

    assert management.get_management_complaints(
        search="parcel"
    )["total"] == 1

    combined = management.get_management_complaints(
        assigned_to="agent-1",
        status="Closed",
    )
    assert combined["total"] == 1
    assert combined["filters"]["status"] == "Closed"


def test_management_complaints_date_range_and_pagination(monkeypatch):
    install_memory_database(monkeypatch, documents=build_filter_dataset())

    recent = management.get_management_complaints(
        date_from=days_ago(7).strftime("%Y-%m-%d"),
    )
    assert recent["total"] == 2

    old = management.get_management_complaints(
        date_to=days_ago(10).strftime("%Y-%m-%d"),
    )
    assert old["total"] == 1

    page_one = management.get_management_complaints(limit=2, page=1)
    assert page_one["count"] == 2
    assert page_one["pages"] == 2
    assert page_one["has_more"] is True

    page_two = management.get_management_complaints(limit=2, page=2)
    assert page_two["count"] == 1
    assert page_two["has_more"] is False

    ids = {row["id"] for row in page_one["complaints"]} | {
        row["id"] for row in page_two["complaints"]
    }
    assert len(ids) == 3


def test_management_complaints_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = management.get_management_complaints()

    assert result["total"] == 0
    assert result["complaints"] == []
    assert result["available_statuses"] == []
