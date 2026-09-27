"""
Tests for api/analytics.py.

The real aggregation pipelines run against mongomock, so a broken
pipeline fails the test instead of silently returning zeros.
"""

from datetime import timedelta

import pytest

from api.tests.analytics_fixtures import (
    days_ago,
    hours_ago,
    install_memory_database,
    make_activity,
    make_analysis,
    make_complaint,
)

import api.analytics as analytics
import api.management as management


# ============================================================
# EMPTY DATABASE
# ============================================================

def test_trends_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = analytics.get_complaint_trends(days=7)

    assert result["days"] == 7
    assert len(result["points"]) == 7
    assert result["totals"]["created"] == 0
    assert result["totals"]["resolved"] == 0
    assert result["totals"]["escalated"] == 0
    assert all(point["created"] == 0 for point in result["points"])


def test_department_performance_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = analytics.get_department_performance()

    assert result["departments"] == []
    assert result["totals"]["total"] == 0


def test_resolution_statistics_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = analytics.get_resolution_statistics()

    assert result["total_complaints"] == 0
    assert result["resolved_complaints"] == 0
    assert result["resolution_rate_percent"] is None
    assert result["average_resolution_hours"] is None
    assert result["median_resolution_hours"] is None
    assert result["timed_resolutions"] == 0


def test_sentiment_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = analytics.get_sentiment_distribution()

    assert result["analyzed_complaints"] == 0
    assert result["distribution"] == {}
    assert result["urgency_available"] is False


def test_validation_statistics_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = analytics.get_validation_statistics()

    assert result["analyzed_complaints"] == 0
    assert result["validation_passed"] == 0
    assert result["validation_failed"] == 0
    assert result["pass_rate_percent"] is None
    assert result["issue_code_distribution"] == {}
    assert result["field_level_comparison_available"] is False


def test_operational_analytics_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = management.get_operational_analytics()

    assert result["total_complaints"] == 0
    assert result["status_distribution"] == {}
    assert result["priority_distribution"] == {}
    assert result["priority_unavailable_count"] == 0
    assert "genai_python_mismatch_count" not in result


# ============================================================
# SINGLE COMPLAINT
# ============================================================

def test_single_complaint_counts(monkeypatch):
    complaint = make_complaint(created_at=days_ago(1))

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [complaint],
            "analyses": [make_analysis(complaint["_id"])],
        },
    )

    trends = analytics.get_complaint_trends(days=7)
    assert trends["totals"]["created"] == 1
    assert trends["totals"]["resolved"] == 0

    performance = analytics.get_department_performance()
    assert len(performance["departments"]) == 1
    assert performance["departments"][0]["department"] == "Billing"
    assert performance["departments"][0]["total"] == 1
    assert performance["departments"][0]["resolved"] == 0
    assert performance["departments"][0]["open"] == 1

    resolution = analytics.get_resolution_statistics()
    assert resolution["total_complaints"] == 1
    assert resolution["resolved_complaints"] == 0
    assert resolution["open_complaints"] == 1


def test_single_resolved_complaint_resolution_time(monkeypatch):
    complaint = make_complaint(
        status="Closed",
        created_at=hours_ago(10),
        resolved_at=hours_ago(4),
        closed_at=hours_ago(4),
    )

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [complaint],
            "analyses": [make_analysis(complaint["_id"])],
        },
    )

    result = analytics.get_resolution_statistics()

    assert result["resolved_complaints"] == 1
    assert result["closed_complaints"] == 1
    assert result["resolution_rate_percent"] == 100.0
    assert result["timed_resolutions"] == 1
    assert result["average_resolution_hours"] == pytest.approx(6.0, abs=0.05)
    assert result["median_resolution_hours"] == pytest.approx(6.0, abs=0.05)
    assert result["fastest_resolution_hours"] == pytest.approx(6.0, abs=0.05)
    assert result["slowest_resolution_hours"] == pytest.approx(6.0, abs=0.05)


def test_resolved_without_timestamp_is_reported_unavailable(monkeypatch):
    """A complaint closed by legacy data carries no resolved_at."""

    resolved = make_complaint(
        status="Closed",
        created_at=hours_ago(8),
        resolved_at=hours_ago(2),
    )
    legacy = make_complaint(status="Closed", created_at=hours_ago(8))

    install_memory_database(
        monkeypatch,
        documents={"complaints": [resolved, legacy]},
    )

    result = analytics.get_resolution_statistics()

    assert result["total_complaints"] == 2
    assert result["resolved_complaints"] == 1
    assert result["timed_resolutions"] == 1
    assert result["resolution_time_unavailable"] == 1


# ============================================================
# MULTIPLE COMPLAINTS, DEPARTMENTS AND STATUSES
# ============================================================

def build_mixed_dataset():
    billing_open = make_complaint(
        department="Billing",
        status="Assigned",
        created_at=days_ago(1),
    )
    # Fixed 5-day-old creation with a 10 hour resolution window.
    # Relative day offsets keep every complaint in its own calendar
    # day bucket no matter what time of day the suite runs.
    resolved_created_at = days_ago(5)
    resolved_at = resolved_created_at + timedelta(hours=10)

    billing_resolved = make_complaint(
        department="Billing",
        status="Closed",
        created_at=resolved_created_at,
        resolved_at=resolved_at,
        closed_at=resolved_at,
    )
    logistics_escalated = make_complaint(
        department="Logistics",
        status="Escalated",
        created_at=days_ago(3),
    )
    review_pending = make_complaint(
        department="Support",
        status="Manual Review",
        created_at=days_ago(2),
        manual_review_required=True,
        review_status="Pending",
    )
    unassigned = make_complaint(
        department=None,
        status="Analyzed",
        created_at=days_ago(4),
    )

    complaints = [
        billing_open,
        billing_resolved,
        logistics_escalated,
        review_pending,
        unassigned,
    ]

    analyses = [
        make_analysis(billing_open["_id"]),
        make_analysis(
            billing_resolved["_id"],
            sentiment="neutral",
        ),
        make_analysis(
            logistics_escalated["_id"],
            category="Delivery & Logistics",
            department="Logistics",
            escalation_required=True,
            escalation_level="Critical",
            escalation_reason="Repeated delivery failure",
            sentiment="angry",
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
                },
                {
                    "code": "WF004",
                    "type": "policy",
                    "message": "Policy not applicable",
                },
            ],
        ),
    ]

    activity = [
        make_activity(
            logistics_escalated["_id"],
            activity_type="escalated",
            title="Escalated",
            timestamp=days_ago(2),
        ),
        make_activity(
            billing_resolved["_id"],
            activity_type="status",
            title="Started handling",
            timestamp=hours_ago(10),
            metadata={
                "previous_status": "Assigned",
                "new_status": "In Progress",
            },
        ),
    ]

    return {
        "complaints": complaints,
        "analyses": analyses,
        "complaint_activity": activity,
    }


def test_department_performance_multiple_departments(monkeypatch):
    install_memory_database(monkeypatch, documents=build_mixed_dataset())

    result = analytics.get_department_performance()

    by_department = {
        row["department"]: row
        for row in result["departments"]
    }

    assert set(by_department) == {
        "Billing",
        "Logistics",
        "Support",
        "Unassigned",
    }

    assert by_department["Billing"]["total"] == 2
    assert by_department["Billing"]["resolved"] == 1
    assert by_department["Billing"]["open"] == 1
    assert by_department["Billing"]["resolution_rate_percent"] == 50.0
    assert by_department["Billing"]["average_resolution_hours"] == (
        pytest.approx(10.0, abs=0.05)
    )

    assert by_department["Logistics"]["escalated"] == 1
    assert by_department["Logistics"]["average_resolution_hours"] is None

    assert by_department["Support"]["manual_review"] == 1

    assert result["totals"]["total"] == 5
    assert result["totals"]["resolved"] == 1


def test_trends_counts_created_resolved_and_escalated(monkeypatch):
    install_memory_database(monkeypatch, documents=build_mixed_dataset())

    result = analytics.get_complaint_trends(days=7)

    assert result["totals"]["created"] == 5
    assert result["totals"]["resolved"] == 1
    assert result["totals"]["escalated"] == 1

    created_days = sum(
        1 for point in result["points"] if point["created"] > 0
    )
    assert created_days == 5

    assert result["points"][-1]["date"] >= result["points"][0]["date"]
    assert all("date" in point for point in result["points"])


def test_trends_department_filter(monkeypatch):
    install_memory_database(monkeypatch, documents=build_mixed_dataset())

    result = analytics.get_complaint_trends(days=7, department="Billing")

    assert result["department"] == "Billing"
    assert result["totals"]["created"] == 2
    assert result["totals"]["resolved"] == 1
    assert result["totals"]["escalated"] == 0


def test_trends_window_is_clamped(monkeypatch):
    install_memory_database(monkeypatch)

    assert len(analytics.get_complaint_trends(days=0)["points"]) == 1
    assert len(analytics.get_complaint_trends(days=5000)["points"]) == 365


def test_sentiment_distribution_multiple(monkeypatch):
    install_memory_database(monkeypatch, documents=build_mixed_dataset())

    result = analytics.get_sentiment_distribution()

    assert result["analyzed_complaints"] == 4
    assert result["distribution"] == {
        "Negative": 2,
        "Angry": 1,
        "Neutral": 1,
    }
    assert result["complaints_without_analysis"] == 1
    assert result["unlabelled_count"] == 0


def test_validation_statistics_multiple(monkeypatch):
    install_memory_database(monkeypatch, documents=build_mixed_dataset())

    result = analytics.get_validation_statistics()

    assert result["analyzed_complaints"] == 4
    assert result["validation_passed"] == 3
    assert result["validation_failed"] == 1
    assert result["pass_rate_percent"] == 75.0
    assert result["manual_review_required"] == 1
    assert result["ground_truth_valid"] == 3
    assert result["ground_truth_failed"] == 1
    assert result["issue_code_distribution"] == {"WF002": 1, "WF004": 1}
    assert result["issue_type_distribution"] == {
        "classification": 1,
        "policy": 1,
    }
    assert result["complaints_with_issues"] == 1


def test_operational_analytics_multiple(monkeypatch):
    install_memory_database(monkeypatch, documents=build_mixed_dataset())

    result = management.get_operational_analytics()

    assert result["total_complaints"] == 5
    assert result["analyzed_complaints"] == 4
    assert result["complaints_without_analysis"] == 1

    assert result["status_distribution"] == {
        "Assigned": 1,
        "Closed": 1,
        "Escalated": 1,
        "Manual Review": 1,
        "Analyzed": 1,
    }

    assert result["department_distribution"]["Billing"] == 2
    assert result["department_distribution"]["Unassigned"] == 1

    assert result["category_distribution"]["Billing & Payments"] == 2
    assert result["category_distribution"]["Not analyzed"] == 1

    assert result["escalation_level_distribution"]["Critical"] == 1
    assert result["escalation_count"] == 1
    assert result["escalation_required_count"] == 1

    assert result["manual_review_count"] == 1
    assert result["validation"]["validation_failed"] == 1

    # No complaint carries a persisted priority in this dataset.
    assert result["priority_distribution"] == {}
    assert result["priority_unavailable_count"] == 5


def test_operational_analytics_uses_persisted_priority(monkeypatch):
    high = make_complaint(priority="High")
    low = make_complaint(priority="Low")
    legacy = make_complaint()

    install_memory_database(
        monkeypatch,
        documents={"complaints": [high, low, legacy]},
    )

    result = management.get_operational_analytics()

    assert result["priority_distribution"] == {"High": 1, "Low": 1}
    assert result["priority_unavailable_count"] == 1


def test_analysis_priority_is_used_when_complaint_has_none(monkeypatch):
    complaint = make_complaint()

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [complaint],
            "analyses": [
                make_analysis(complaint["_id"], priority="Critical")
            ],
        },
    )

    result = management.get_operational_analytics()

    assert result["priority_distribution"] == {"Critical": 1}
    assert result["priority_unavailable_count"] == 0


# ============================================================
# MISSING OPTIONAL FIELDS
# ============================================================

def test_missing_optional_fields_do_not_break_pipelines(monkeypatch):
    """A bare complaint document (no analysis, no department)."""

    bare = {"_id": make_complaint()["_id"], "status": "New"}

    install_memory_database(monkeypatch, documents={"complaints": [bare]})

    trends = analytics.get_complaint_trends(days=3)
    assert trends["totals"]["created"] == 0
    assert trends["undated_complaints"] == 1

    performance = analytics.get_department_performance()
    assert performance["departments"][0]["department"] == "Unassigned"

    resolution = analytics.get_resolution_statistics()
    assert resolution["total_complaints"] == 1
    assert resolution["average_resolution_hours"] is None

    sentiment = analytics.get_sentiment_distribution()
    assert sentiment["analyzed_complaints"] == 0
    assert sentiment["complaints_without_analysis"] == 1

    operational = management.get_operational_analytics()
    assert operational["status_distribution"] == {"New": 1}
    assert operational["category_distribution"] == {"Not analyzed": 1}
