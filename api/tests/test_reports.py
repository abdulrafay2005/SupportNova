"""
Tests for api/reports.py: the eight SRS report types, their
honest "unavailable" declarations, and the CSV export.
"""

import csv
import io

import pytest

from api.tests.analytics_fixtures import (
    days_ago,
    hours_ago,
    install_memory_database,
    make_activity,
    make_analysis,
    make_complaint,
    make_user,
)

import api.reports as reports


ALL_TYPES = [
    "complaint-analysis",
    "department-performance",
    "escalations",
    "sla-status",
    "policy-usage",
    "resolution-compliance",
    "genai-python-comparison",
    "manual-reviews",
]


def build_report_dataset():
    billing_open = make_complaint(
        department="Billing",
        status="Assigned",
        created_at=days_ago(2),
        priority="High",
        sla_hours=24,
        sla_due_at=days_ago(1),
    )
    billing_closed = make_complaint(
        department="Billing",
        status="Closed",
        created_at=hours_ago(30),
        resolved_at=hours_ago(20),
        closed_at=hours_ago(20),
        resolution_comment="Refund issued",
        priority="Medium",
        sla_hours=48,
        sla_due_at=hours_ago(-18),
    )
    logistics_escalated = make_complaint(
        department="Logistics",
        status="Escalated",
        created_at=days_ago(4),
    )
    review_pending = make_complaint(
        department="Support",
        status="Manual Review",
        manual_review_required=True,
        review_status="Pending",
        created_at=days_ago(1),
    )
    reviewed = make_complaint(
        department="Support",
        status="Assigned",
        review_status="Completed",
        reviewer_id="reviewer-1",
        created_at=days_ago(3),
        review_history=[
            {
                "reviewer_id": "reviewer-1",
                "reviewer_name": "Rita Reviewer",
                "reviewer_role": "Reviewer",
                "action": "Approve",
                "comment": "Looks correct",
                "changes": {},
                "original_analysis": {},
                "created_at": days_ago(2),
            }
        ],
    )

    analyses = [
        make_analysis(billing_open["_id"]),
        make_analysis(
            billing_closed["_id"],
            sentiment="neutral",
            resolution_steps=["Verify", "Refund"],
        ),
        make_analysis(
            logistics_escalated["_id"],
            category="Delivery & Logistics",
            department="Logistics",
            escalation_required=True,
            escalation_level="Critical",
            escalation_reason="Repeated delivery failure",
            policies=[
                {
                    "Policy_ID": "POL11",
                    "Policy_Name": "Delivery Guarantee",
                    "Owner_Department": "Logistics",
                    "Status": "Active",
                }
            ],
        ),
        make_analysis(
            review_pending["_id"],
            category="Service Quality",
            department="Support",
            validation_status="Failed",
            ground_truth_valid=False,
            manual_review_required=True,
            issues=[
                {
                    "code": "WF002",
                    "type": "classification",
                    "message": "Category mismatch",
                }
            ],
            ai_blocked=True,
        ),
    ]

    activity = [
        make_activity(
            logistics_escalated["_id"],
            activity_type="escalated",
            title="Escalated",
            timestamp=days_ago(3),
            actor="Adam Agent",
            actor_role="Agent",
        ),
    ]

    users = [
        make_user(role="Agent", department="Billing"),
        make_user(
            role="Agent",
            department="Logistics",
            email="agent2@example.com",
        ),
        make_user(role="Manager", department="Billing", email="m@example.com"),
    ]

    return {
        "complaints": [
            billing_open,
            billing_closed,
            logistics_escalated,
            review_pending,
            reviewed,
        ],
        "analyses": analyses,
        "complaint_activity": activity,
        "users": users,
    }


# ============================================================
# CATALOGUE AND DISPATCH
# ============================================================

def test_report_catalogue_lists_the_eight_srs_reports():
    catalogue = reports.list_reports()

    assert [row["report_type"] for row in catalogue["reports"]] == (
        ALL_TYPES
    )
    assert all(
        row["export_formats"] == ["csv"]
        for row in catalogue["reports"]
    )
    assert {
        row["format"]
        for row in catalogue["export_formats_unavailable"]
    } == {"pdf", "xlsx"}


def test_unknown_report_type_raises(monkeypatch):
    install_memory_database(monkeypatch)

    with pytest.raises(reports.UnknownReportType):
        reports.generate_report("not-a-report")


@pytest.mark.parametrize("report_type", ALL_TYPES)
def test_every_report_runs_on_an_empty_database(
    report_type,
    monkeypatch,
):
    install_memory_database(monkeypatch)

    report = reports.generate_report(report_type)

    assert report["report_type"] == report_type
    assert report["rows"] == []
    assert report["row_count"] == 0
    assert isinstance(report["summary"], dict)
    assert isinstance(report["columns"], list)
    assert len(report["columns"]) > 0


@pytest.mark.parametrize("report_type", ALL_TYPES)
def test_every_report_runs_on_a_full_dataset(
    report_type,
    monkeypatch,
):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report(report_type)

    assert report["report_type"] == report_type
    assert report["row_count"] == len(report["rows"])

    for row in report["rows"]:
        assert isinstance(row, dict)


# ============================================================
# INDIVIDUAL REPORTS
# ============================================================

def test_complaint_analysis_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("complaint-analysis")

    assert report["summary"]["total_complaints"] == 5
    assert (
        report["summary"]["category_distribution"][
            "Billing & Payments"
        ]
        == 2
    )
    assert report["summary"]["category_distribution"][
        "Not analyzed"
    ] == 1

    closed = [
        row for row in report["rows"] if row["resolved_at"]
    ][0]
    assert closed["resolution_hours"] == pytest.approx(10.0, abs=0.05)
    assert closed["priority"] == "Medium"


def test_complaint_analysis_respects_filters(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report(
        "complaint-analysis",
        department="Billing",
    )

    assert report["filters"]["department"] == "Billing"
    assert report["row_count"] == 2

    dated = reports.generate_report(
        "complaint-analysis",
        date_from=days_ago(2).strftime("%Y-%m-%d"),
    )
    assert dated["row_count"] <= 5
    assert dated["row_count"] >= 2


def test_department_performance_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("department-performance")

    rows = {row["department"]: row for row in report["rows"]}

    assert rows["Billing"]["total"] == 2
    assert rows["Billing"]["resolved"] == 1
    assert rows["Billing"]["agents"] == 1
    assert rows["Logistics"]["escalated"] == 1
    assert rows["Support"]["total"] == 2
    assert report["summary"]["departments"] == 3


def test_escalations_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("escalations")

    assert report["summary"]["escalated_complaints"] == 1
    assert report["summary"]["currently_escalated"] == 1
    assert report["summary"]["level_distribution"] == {"Critical": 1}

    row = report["rows"][0]
    assert row["escalation_reason"] == "Repeated delivery failure"
    assert row["escalated_by"] == "Adam Agent"


def test_sla_status_report_reports_unavailable_targets(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("sla-status")

    summary = report["summary"]
    assert summary["total_complaints"] == 5
    assert summary["with_sla_target"] == 2
    assert summary["without_sla_target"] == 3
    assert summary["at_risk_threshold_ratio"] == 0.2

    metrics = {item["metric"] for item in report["unavailable"]}
    assert "sla_target" in metrics
    assert "response_sla" in metrics


def test_policy_usage_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("policy-usage")

    rows = {row["policy_id"]: row for row in report["rows"]}

    assert rows["POL07"]["times_applied"] == 3
    assert rows["POL11"]["policy_name"] == "Delivery Guarantee"
    assert report["summary"]["analyses_total"] == 4
    assert report["summary"]["analyses_with_policies"] == 4
    assert report["summary"]["distinct_policies_applied"] == 2


def test_resolution_compliance_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("resolution-compliance")

    assert report["summary"]["finished_complaints"] == 1
    assert report["summary"]["with_resolution_comment"] == 1
    assert report["summary"]["with_resolution_timestamp"] == 1
    assert report["summary"]["compliance_percent"] == 100.0

    row = report["rows"][0]
    assert row["resolution_steps"] == 2
    assert row["has_resolution_comment"] is True


def test_genai_python_comparison_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("genai-python-comparison")

    assert report["summary"]["analyses"] == 4
    assert report["summary"]["validation_failed"] == 1
    assert report["summary"]["ai_output_blocked"] == 1

    blocked = [
        row for row in report["rows"] if row["ai_output_blocked"]
    ][0]
    assert blocked["issue_codes"] == "WF002"

    metrics = {item["metric"] for item in report["unavailable"]}
    assert "field_level_agreement" in metrics


def test_manual_reviews_report(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("manual-reviews")

    assert report["summary"]["pending_reviews"] == 1
    assert report["summary"]["completed_reviews"] == 1
    assert report["summary"]["outcome_distribution"] == {"Approve": 1}
    assert report["summary"]["reviewer_distribution"] == {
        "Rita Reviewer": 1
    }

    reviewed = [
        row for row in report["rows"] if row["review_actions"] > 0
    ][0]
    assert reviewed["last_action"] == "Approve"
    assert reviewed["last_reviewer"] == "Rita Reviewer"


# ============================================================
# CSV EXPORT
# ============================================================

def test_csv_export_contains_header_summary_and_rows(monkeypatch):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("complaint-analysis")
    text = reports.render_report_csv(report)

    parsed = list(csv.reader(io.StringIO(text)))

    assert parsed[0][0] == "SupportNova report"
    assert parsed[0][1] == "Complaint Analysis"
    assert any(row and row[0] == "Summary" for row in parsed)
    assert any(
        row and row[0] == "Unavailable metrics" for row in parsed
    )

    header_index = next(
        index
        for index, row in enumerate(parsed)
        if row and row[0] == "Complaint ID"
    )

    data_rows = [row for row in parsed[header_index + 1:] if row]
    assert len(data_rows) == report["row_count"]

    labels = [column["label"] for column in report["columns"]]
    assert parsed[header_index] == labels


def test_csv_export_of_empty_report(monkeypatch):
    install_memory_database(monkeypatch)

    report = reports.generate_report("manual-reviews")
    text = reports.render_report_csv(report)

    parsed = list(csv.reader(io.StringIO(text)))

    assert parsed[0][1] == "Manual Reviews"
    assert any(row and row[0] == "Complaint ID" for row in parsed)


def test_csv_export_formats_values_without_inventing_data(
    monkeypatch,
):
    install_memory_database(
        monkeypatch,
        documents=build_report_dataset(),
    )

    report = reports.generate_report("resolution-compliance")
    text = reports.render_report_csv(report)

    assert "Yes" in text  # boolean rendering
    assert ",," in text or "\n" in text  # empty values stay empty
    assert "None" not in text
