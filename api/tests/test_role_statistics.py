"""
Tests for the reviewer and agent statistics aggregations.

Real pipelines run against mongomock; documents match exactly
what api/review.py and api/agent.py persist.
"""

import pytest

from api.tests.analytics_fixtures import (
    NOW,
    days_ago,
    hours_ago,
    install_memory_database,
    make_activity,
    make_analysis,
    make_complaint,
)

import api.agent as agent_module
import api.review as review_module


REVIEWER = {
    "id": "reviewer-1",
    "name": "Rita Reviewer",
    "role": "Reviewer",
}

AGENT = {
    "id": "agent-1",
    "name": "Adam Agent",
    "role": "Agent",
}


def review_entry(action, *, reviewer_id="reviewer-1", when=None):
    return {
        "reviewer_id": reviewer_id,
        "reviewer_name": (
            "Rita Reviewer"
            if reviewer_id == "reviewer-1"
            else "Rob Reviewer"
        ),
        "reviewer_role": "Reviewer",
        "action": action,
        "comment": f"{action} comment",
        "changes": {},
        "original_analysis": {},
        "created_at": when or hours_ago(3),
    }


# ============================================================
# REVIEW STATISTICS
# ============================================================

def test_review_statistics_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = review_module.get_review_statistics(REVIEWER)

    assert result["pending_reviews"] == 0
    assert result["completed_reviews"] == 0
    assert result["total_review_actions"] == 0
    assert result["outcome_counts"]["Approve"] == 0
    assert result["reviewer_workload"] == []
    assert result["recent_activity"] == []
    assert result["my_statistics"]["actions"] == 0
    assert result["validation"]["analyzed_complaints"] == 0


def test_review_statistics_counts_pending_queue(monkeypatch):
    pending = make_complaint(
        status="Manual Review",
        manual_review_required=True,
        review_status="Pending",
    )
    legacy_pending = make_complaint(
        status="Manual Review",
        manual_review_required=True,
        review_status=None,
    )
    not_pending = make_complaint(status="Assigned")

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [pending, legacy_pending, not_pending]
        },
    )

    result = review_module.get_review_statistics(REVIEWER)

    assert result["pending_reviews"] == 2
    assert result["completed_reviews"] == 0


def test_review_statistics_outcomes_and_workload(monkeypatch):
    approved = make_complaint(
        status="Assigned",
        manual_review_required=False,
        review_status="Completed",
        reviewer_id="reviewer-1",
        review_history=[review_entry("Approve")],
    )
    modified = make_complaint(
        status="Assigned",
        review_status="Completed",
        reviewer_id="reviewer-1",
        review_history=[
            review_entry("Comment", when=hours_ago(5)),
            review_entry("Modify", when=hours_ago(4)),
        ],
    )
    escalated = make_complaint(
        status="Escalated",
        review_status="Completed",
        reviewer_id="reviewer-2",
        review_history=[
            review_entry("Escalate", reviewer_id="reviewer-2")
        ],
    )
    rejected = make_complaint(
        status="Escalated",
        review_status="Completed",
        reviewer_id="reviewer-2",
        review_history=[
            review_entry("Reject", reviewer_id="reviewer-2"),
            review_entry(
                "Regenerate Response",
                reviewer_id="reviewer-2",
            ),
        ],
    )
    reclassified = make_complaint(
        status="Assigned",
        review_status="Completed",
        reviewer_id="reviewer-1",
        review_history=[
            review_entry("Reclassify"),
            review_entry("Reassign"),
        ],
    )

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [
                approved,
                modified,
                escalated,
                rejected,
                reclassified,
            ]
        },
    )

    result = review_module.get_review_statistics(REVIEWER)

    assert result["completed_reviews"] == 5
    assert result["complaints_with_review_history"] == 5

    assert result["outcome_counts"] == {
        "Approve": 1,
        "Reject": 1,
        "Modify": 1,
        "Reclassify": 1,
        "Reassign": 1,
        "Escalate": 1,
        "Regenerate Response": 1,
        "Comment": 1,
    }
    assert result["other_outcome_counts"] == {}
    assert result["total_review_actions"] == 8

    workload = {
        row["reviewer_id"]: row
        for row in result["reviewer_workload"]
    }
    assert workload["reviewer-1"]["actions"] == 5
    assert workload["reviewer-1"]["approvals"] == 1
    assert workload["reviewer-2"]["actions"] == 3
    assert workload["reviewer-2"]["rejections"] == 1
    assert workload["reviewer-1"]["reviewer_name"] == "Rita Reviewer"

    assert result["my_statistics"]["reviewer_id"] == "reviewer-1"
    assert result["my_statistics"]["actions"] == 5
    assert result["my_statistics"]["completed_reviews"] == 3

    assert len(result["recent_activity"]) > 0
    assert all(
        entry["action"] for entry in result["recent_activity"]
    )


def test_review_statistics_without_reviewer_context(monkeypatch):
    install_memory_database(monkeypatch)

    result = review_module.get_review_statistics(None)

    assert result["my_statistics"] is None


def test_review_statistics_reports_unknown_actions(monkeypatch):
    complaint = make_complaint(
        review_history=[review_entry("Legacy Action")],
    )

    install_memory_database(
        monkeypatch,
        documents={"complaints": [complaint]},
    )

    result = review_module.get_review_statistics(REVIEWER)

    assert result["other_outcome_counts"] == {"Legacy Action": 1}
    assert result["total_review_actions"] == 1


def test_review_statistics_includes_validation_issues(monkeypatch):
    complaint = make_complaint(
        status="Manual Review",
        manual_review_required=True,
        review_status="Pending",
    )

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [complaint],
            "analyses": [
                make_analysis(
                    complaint["_id"],
                    validation_status="Failed",
                    ground_truth_valid=False,
                    manual_review_required=True,
                    issues=[
                        {
                            "code": "WF001",
                            "type": "schema",
                            "message": "Missing field",
                        }
                    ],
                )
            ],
        },
    )

    result = review_module.get_review_statistics(REVIEWER)

    assert result["validation"]["validation_failed"] == 1
    assert result["validation"]["issue_code_distribution"] == {
        "WF001": 1
    }


# ============================================================
# AGENT STATISTICS
# ============================================================

def test_agent_statistics_empty_database(monkeypatch):
    install_memory_database(monkeypatch)

    result = agent_module.get_agent_statistics(AGENT)

    assert result["assigned_total"] == 0
    assert result["open"] == 0
    assert result["resolved"] == 0
    assert result["status_distribution"] == {}
    assert result["average_resolution_hours"] is None
    assert result["average_handling_hours"] is None
    assert result["resolution_rate_percent"] is None
    assert result["recent_activity"] == []


def test_agent_statistics_only_counts_own_complaints(monkeypatch):
    mine = make_complaint(assigned_to="agent-1", status="Assigned")
    other = make_complaint(assigned_to="agent-2", status="Assigned")

    install_memory_database(
        monkeypatch,
        documents={"complaints": [mine, other]},
    )

    result = agent_module.get_agent_statistics(AGENT)

    assert result["assigned_total"] == 1
    assert result["open"] == 1
    assert result["status_distribution"] == {"Assigned": 1}


def test_agent_statistics_workload_breakdown(monkeypatch):
    assigned = make_complaint(
        assigned_to="agent-1",
        status="Assigned",
        created_at=hours_ago(6),
    )
    in_progress = make_complaint(
        assigned_to="agent-1",
        status="In Progress",
        created_at=hours_ago(12),
    )
    awaiting = make_complaint(
        assigned_to="agent-1",
        status="Awaiting Customer",
        created_at=hours_ago(30),
    )
    escalated = make_complaint(
        assigned_to="agent-1",
        status="Escalated",
        created_at=days_ago(3),
    )
    closed = make_complaint(
        assigned_to="agent-1",
        status="Closed",
        created_at=hours_ago(20),
        resolved_at=hours_ago(8),
        closed_at=hours_ago(8),
    )

    activity = [
        make_activity(
            closed["_id"],
            activity_type="status",
            title="Started handling",
            timestamp=hours_ago(14),
            metadata={
                "previous_status": "Assigned",
                "new_status": "In Progress",
            },
            actor="Adam Agent",
            actor_role="Agent",
        ),
        make_activity(
            closed["_id"],
            activity_type="resolved",
            title="Complaint resolved",
            timestamp=hours_ago(8),
            actor="Adam Agent",
            actor_role="Agent",
        ),
    ]

    install_memory_database(
        monkeypatch,
        documents={
            "complaints": [
                assigned,
                in_progress,
                awaiting,
                escalated,
                closed,
            ],
            "complaint_activity": activity,
        },
    )

    result = agent_module.get_agent_statistics(AGENT)

    assert result["assigned_total"] == 5
    assert result["open"] == 3
    assert result["in_progress"] == 1
    assert result["awaiting_customer"] == 1
    assert result["escalated"] == 1
    assert result["closed"] == 1
    assert result["resolved"] == 1
    assert result["resolution_rate_percent"] == 20.0

    assert result["status_distribution"] == {
        "Assigned": 1,
        "Awaiting Customer": 1,
        "Closed": 1,
        "Escalated": 1,
        "In Progress": 1,
    }

    # created 20h ago, resolved 8h ago -> 12h in the system
    assert result["average_resolution_hours"] == pytest.approx(
        12.0,
        abs=0.05,
    )
    assert result["timed_resolutions"] == 1

    # picked up 14h ago, resolved 8h ago -> 6h of handling
    assert result["average_handling_hours"] == pytest.approx(
        6.0,
        abs=0.05,
    )
    assert result["measured_handling_count"] == 1
    assert result["handling_time_unavailable"] == 0

    assert result["average_open_age_hours"] == pytest.approx(
        (6 + 12 + 30) / 3,
        abs=0.1,
    )
    assert result["oldest_open_age_hours"] == pytest.approx(
        30.0,
        abs=0.1,
    )

    assert len(result["recent_activity"]) == 2
    assert result["recent_activity"][0]["timestamp"] is not None


def test_agent_handling_time_unavailable_without_transition(
    monkeypatch,
):
    """Resolved with no stored In Progress event -> unmeasurable."""

    closed = make_complaint(
        assigned_to="agent-1",
        status="Closed",
        created_at=hours_ago(10),
        resolved_at=hours_ago(1),
        closed_at=hours_ago(1),
    )

    install_memory_database(
        monkeypatch,
        documents={"complaints": [closed]},
    )

    result = agent_module.get_agent_statistics(AGENT)

    assert result["resolved"] == 1
    assert result["timed_resolutions"] == 1
    assert result["average_handling_hours"] is None
    assert result["measured_handling_count"] == 0
    assert result["handling_time_unavailable"] == 1


def test_agent_statistics_missing_optional_fields(monkeypatch):
    bare = {
        "_id": make_complaint()["_id"],
        "assigned_to": "agent-1",
        "status": "Assigned",
    }

    install_memory_database(
        monkeypatch,
        documents={"complaints": [bare]},
    )

    result = agent_module.get_agent_statistics(AGENT)

    assert result["assigned_total"] == 1
    assert result["average_open_age_hours"] is None
    assert result["oldest_open_age_hours"] is None
    assert result["average_resolution_hours"] is None
