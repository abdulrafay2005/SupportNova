import copy
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import (
    complaints_collection,
    analyses_collection,
    users_collection,
)
from api.audit import create_audit_log
from api.activity import create_complaint_activity
from api.assignment import auto_assign_complaint
from api.analytics import get_validation_statistics
from ml.genai import generate_ai_fields, merge_ai_result, openai_enabled

# ============================================================
# HELPERS
# ============================================================

def _get_complaint(complaint_id: str):
    try:
        object_id = ObjectId(complaint_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    complaint = complaints_collection.find_one({
        "_id": object_id
    })

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    return object_id, complaint


def _require_pending_review(complaint: dict):
    """
    Validate that the complaint is currently waiting for reviewer action.

    Canonical state:
        manual_review_required = True
        status = "Manual Review"
        review_status = "Pending"

    Legacy/manual-test state also accepted:
        manual_review_required = True
        status = "Manual Review"
        review_status = None

    The latter is supported so manually created/older review records
    are not incorrectly hidden from the reviewer workflow.
    """

    if complaint.get("manual_review_required") is not True:
        raise HTTPException(
            status_code=400,
            detail="This complaint does not require manual review"
        )

    status = complaint.get("status")
    review_status = complaint.get("review_status")

    if status != "Manual Review":
        raise HTTPException(
            status_code=400,
            detail="This complaint is not currently in Manual Review"
        )

    if review_status not in {"Pending", None}:
        raise HTTPException(
            status_code=400,
            detail="This complaint has already been reviewed"
        )

def _get_analysis(complaint_id: str):
    analysis_document = analyses_collection.find_one({
        "complaint_id": complaint_id
    })

    if not analysis_document:
        raise HTTPException(
            status_code=404,
            detail="Complaint analysis not found"
        )

    return analysis_document["analysis"]


def _save_analysis(
    complaint_id: str,
    analysis: dict
):
    analyses_collection.update_one(
        {
            "complaint_id": complaint_id
        },
        {
            "$set": {
                "analysis": analysis,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )


def _record_review_history(
    *,
    complaint_id: str,
    reviewer: dict,
    action: str,
    comment: str | None,
    original_analysis: dict,
    changes: dict | None = None
):
    history_entry = {
        "reviewer_id": reviewer["id"],
        "reviewer_name": reviewer["name"],
        "reviewer_role": reviewer["role"],
        "action": action,
        "comment": comment,
        "changes": changes or {},
        "original_analysis": copy.deepcopy(original_analysis),
        "created_at": datetime.now(timezone.utc)
    }

    try:
        object_id = ObjectId(complaint_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    complaints_collection.update_one(
        {
            "_id": object_id
        },
        {
            "$push": {
                "review_history": history_entry
            }
        }
    )


def _complete_review(
    *,
    complaint_id: str,
    complaint_object_id,
    reviewer: dict,
    action: str,
    next_status: str,
    comment: str | None,
    original_analysis: dict,
    changes: dict | None = None,
    extra_fields: dict | None = None
):
    now = datetime.now(timezone.utc)

    update_fields = {
        "status": next_status,
        "manual_review_required": False,
        "review_status": "Completed",
        "reviewer_id": reviewer["id"],
        "updated_at": now
    }

    if extra_fields:
        update_fields.update(extra_fields)

    complaints_collection.update_one(
        {
            "_id": complaint_object_id
        },
        {
            "$set": update_fields
        }
    )

    _record_review_history(
        complaint_id=complaint_id,
        reviewer=reviewer,
        action=action,
        comment=comment,
        original_analysis=original_analysis,
        changes=changes
    )

    create_audit_log(
        actor_id=reviewer["id"],
        actor_role=reviewer["role"],
        action=f"Review: {action}",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "comment": comment,
            "changes": changes or {},
            "resulting_status": next_status
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type=(
            "assigned" if action == "Reassign"
            else "escalated" if action in {"Escalate", "Reject"}
            else "status"
        ),
        title=f"Reviewer: {action}",
        description=comment or "",
        actor=reviewer.get("name", "Reviewer"),
        actor_role=reviewer["role"],
        metadata={
            "changes": changes or {},
            "resulting_status": next_status,
        },
    )

    # --------------------------------------------------------
    # POST-REVIEW ROUTING
    #
    # When the reviewer's decision returns the complaint to
    # normal handling ("Analyzed"), it must actually enter the
    # agent workflow: route it through the existing automatic
    # assignment system. Escalated outcomes stay escalated
    # (management workflow) and Reassign already carries an
    # explicit agent — neither is auto-assigned.
    # --------------------------------------------------------
    final_status = next_status
    assigned_agent = None

    if next_status == "Analyzed":
        updated_complaint = complaints_collection.find_one(
            {"_id": complaint_object_id}
        ) or {}

        agent = auto_assign_complaint(
            complaint_object_id=complaint_object_id,
            complaint_id=complaint_id,
            department=updated_complaint.get(
                "assigned_department"
            ),
        )

        if agent:
            final_status = "Assigned"
            assigned_agent = {
                "id": str(agent["_id"]),
                "name": agent.get("name"),
                "department": agent.get("department"),
            }

    # --------------------------------------------------------
    # POST-CONDITION: "Assigned" always has an owner.
    #
    # A complaint that says "Assigned" while `assigned_to` is null
    # belongs to no agent queue and is invisible to every role but
    # management. If that ever happens the complaint is put back
    # into "Analyzed" and the reason is recorded, so it stays
    # visible as unrouted work instead of silently disappearing.
    # --------------------------------------------------------
    stored = complaints_collection.find_one(
        {"_id": complaint_object_id}
    ) or {}

    if (
        stored.get("status") == "Assigned"
        and not stored.get("assigned_to")
    ):
        complaints_collection.update_one(
            {"_id": complaint_object_id},
            {
                "$set": {
                    "status": "Analyzed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="routed",
            title="Awaiting manual assignment",
            description=(
                "The review outcome could not be routed to an "
                "agent, so the complaint stays unassigned."
            ),
            metadata={
                "department": stored.get("assigned_department"),
            },
        )

        final_status = "Analyzed"
        assigned_agent = None

    return {
        "message": f"Review action '{action}' completed successfully",
        "complaint_id": complaint_id,
        "action": action,
        "status": final_status,
        "assigned_agent": assigned_agent,
        "review_status": "Completed",
        "reviewer_id": reviewer["id"]
    }


# ============================================================
# APPROVE
# ============================================================

def approve_review(
    *,
    complaint_id: str,
    reviewer: dict,
    comment: str | None = None
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(
        complaint_id
    )

    # --------------------------------------------------------
    # An approved complaint re-enters normal handling, which means
    # it must be routed by the existing assignment service.
    #
    # It is deliberately NOT written as "Assigned" here: that
    # produced complaints with status "Assigned" and
    # assigned_to = null, which belong to no agent queue.
    # `_complete_review` promotes the complaint to "Assigned" only
    # once a real agent has been persisted on it.
    # --------------------------------------------------------
    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Approve",
        next_status="Analyzed",
        comment=comment,
        original_analysis=original_analysis
    )

# ============================================================
# MODIFY
# ============================================================

def modify_review(
    *,
    complaint_id: str,
    reviewer: dict,
    comment: str,
    customer_response: str | None = None,
    agent_guidance: str | None = None
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(complaint_id)

    # Preserve exact pre-review recommendation
    original_analysis_snapshot = copy.deepcopy(
        original_analysis
    )

    changes = {}

    if customer_response is not None:
        changes["customer_response"] = {
            "before": original_analysis.get(
                "customer_response"
            ),
            "after": customer_response
        }

        original_analysis["customer_response"] = (
            customer_response
        )

    if agent_guidance is not None:
        changes["agent_guidance"] = {
            "before": original_analysis.get(
                "agent_guidance"
            ),
            "after": agent_guidance
        }

        original_analysis["agent_guidance"] = (
            agent_guidance
        )

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No changes were provided"
        )

    _save_analysis(
        complaint_id,
        original_analysis
    )

    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Modify",
        next_status="Analyzed",
        comment=comment,
        original_analysis=original_analysis_snapshot,
        changes=changes
    )


# ============================================================
# RECLASSIFY
# ============================================================

def reclassify_review(
    *,
    complaint_id: str,
    reviewer: dict,
    category: str,
    subcategory: str,
    department: str,
    comment: str
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(complaint_id)

    # Preserve exact pre-review recommendation
    original_analysis_snapshot = copy.deepcopy(
        original_analysis
    )

    old_classification = dict(
        original_analysis.get("classification", {})
    )

    old_department = complaint.get(
        "assigned_department"
    )

    new_classification = {
        "category": category,
        "subcategory": subcategory,
        "department": department
    }

    original_analysis["classification"] = (
        new_classification
    )

    routing = original_analysis.get(
        "routing",
        {}
    )

    routing["primary_department"] = department

    original_analysis["routing"] = routing

    _save_analysis(
        complaint_id,
        original_analysis
    )

    changes = {
        "classification": {
            "before": old_classification,
            "after": new_classification
        },
        "department": {
            "before": old_department,
            "after": department
        }
    }

    complaints_collection.update_one(
        {
            "_id": complaint_object_id
        },
        {
            "$set": {
                "assigned_department": department
            }
        }
    )

    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Reclassify",
        next_status="Analyzed",
        comment=comment,
        original_analysis=original_analysis_snapshot,
        changes=changes
    )


# ============================================================
# REASSIGN
# ============================================================

def reassign_review(
    *,
    complaint_id: str,
    reviewer: dict,
    agent_id: str,
    comment: str
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(
        complaint_id
    )

    # FIX:
    # Preserve the exact analysis before the reassignment.
    original_analysis_snapshot = copy.deepcopy(
        original_analysis
    )

    try:
        agent_object_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid agent ID"
        )

    agent = users_collection.find_one({
        "_id": agent_object_id,
        "role": "Agent",
        "status": "Active"
    })

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Active agent not found"
        )

    # Ensure the reviewer cannot assign the complaint
    # to an agent from another department.
    complaint_department = complaint.get(
        "assigned_department"
    )

    agent_department = agent.get(
        "department"
    )

    if (
        complaint_department
        and agent_department
        and complaint_department != agent_department
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Agent does not belong to the complaint's "
                "assigned department"
            )
        )

    old_agent = complaint.get(
        "assigned_to"
    )

    changes = {
        "assigned_to": {
            "before": old_agent,
            "after": agent_id
        }
    }

    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Reassign",
        next_status="Assigned",
        comment=comment,
        original_analysis=original_analysis_snapshot,
        changes=changes,
        extra_fields={
            "assigned_to": agent_id
        }
    )


# ============================================================
# ESCALATE
# ============================================================

def escalate_review(
    *,
    complaint_id: str,
    reviewer: dict,
    comment: str
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(
        complaint_id
    )

    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Escalate",
        next_status="Escalated",
        comment=comment,
        original_analysis=original_analysis
    )


# ============================================================
# REJECT
# ============================================================

def reject_review(
    *,
    complaint_id: str,
    reviewer: dict,
    comment: str
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(
        complaint_id
    )

    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Reject",
        next_status="Escalated",
        comment=comment,
        original_analysis=original_analysis
    )


# ============================================================
# COMMENT
# ============================================================

def add_review_comment(
    *,
    complaint_id: str,
    reviewer: dict,
    comment: str
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    original_analysis = _get_analysis(
        complaint_id
    )

    _record_review_history(
        complaint_id=complaint_id,
        reviewer=reviewer,
        action="Comment",
        comment=comment,
        original_analysis=original_analysis
    )

    create_audit_log(
        actor_id=reviewer["id"],
        actor_role=reviewer["role"],
        action="Review comment added",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "comment": comment
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="note",
        title="Reviewer added a comment",
        description=comment,
        actor=reviewer.get("name", "Reviewer"),
        actor_role=reviewer["role"],
    )

    return {
        "message": "Review comment added successfully",
        "complaint_id": complaint_id,
        "action": "Comment"
    }

# ============================================================
# REGENERATE RESPONSE
# ============================================================

def regenerate_review_response(
    *,
    complaint_id: str,
    reviewer: dict,
    comment: str
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    _require_pending_review(complaint)

    if not openai_enabled():
        raise HTTPException(
            status_code=503,
            detail=(
                "OpenAI regeneration is currently disabled. "
                "Enable OPENAI_ENABLED=true before regenerating "
                "the response."
            )
        )

    original_analysis = _get_analysis(
        complaint_id
    )

    # Preserve the exact pre-regeneration analysis.
    original_analysis_snapshot = copy.deepcopy(
        original_analysis
    )

    try:
        # The stored analysis already contains the trusted
        # deterministic intelligence required by generate_ai_fields().
        ai_data = generate_ai_fields(
            original_analysis
        )

        regenerated_analysis = merge_ai_result(
            original_analysis,
            ai_data
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Response regeneration failed: {str(error)}"
        )

    changes = {
        "customer_response": {
            "before": original_analysis.get(
                "customer_response"
            ),
            "after": regenerated_analysis.get(
                "customer_response"
            )
        },
        "agent_guidance": {
            "before": original_analysis.get(
                "agent_guidance"
            ),
            "after": regenerated_analysis.get(
                "agent_guidance"
            )
        },
        "clarification_questions": {
            "before": original_analysis.get(
                "clarification_questions"
            ),
            "after": regenerated_analysis.get(
                "clarification_questions"
            )
        }
    }

    _save_analysis(
        complaint_id,
        regenerated_analysis
    )

    return _complete_review(
        complaint_id=complaint_id,
        complaint_object_id=complaint_object_id,
        reviewer=reviewer,
        action="Regenerate Response",
        next_status="Analyzed",
        comment=comment,
        original_analysis=original_analysis_snapshot,
        changes=changes
    )

# ============================================================
# REVIEW STATISTICS
#
# Read-only aggregations over data the review workflow already
# persists:
#
#   complaints.review_status / manual_review_required / status
#   complaints.review_history[]  (written by _record_review_history)
#   analyses.analysis.validation (written by validate_workflow)
#
# No reviewer action or workflow transition is performed here.
# ============================================================

REVIEW_ACTIONS = [
    "Approve",
    "Reject",
    "Modify",
    "Reclassify",
    "Reassign",
    "Escalate",
    "Regenerate Response",
    "Comment",
]

PENDING_REVIEW_QUERY = {
    "manual_review_required": True,
    "status": "Manual Review",
    "$or": [
        {"review_status": "Pending"},
        {"review_status": None},
    ],
}


def get_review_statistics(reviewer: dict | None = None):
    """
    Queue size, review outcomes, reviewer workload and validation
    issue distribution.

    Every number is derived from persisted documents. Metrics the
    schema cannot support are not estimated.
    """

    pending = complaints_collection.count_documents(
        PENDING_REVIEW_QUERY
    )

    completed = complaints_collection.count_documents({
        "review_status": "Completed"
    })

    flagged_total = complaints_collection.count_documents({
        "review_history": {"$exists": True, "$ne": []}
    })

    outcome_rows = list(
        complaints_collection.aggregate([
            {"$match": {"review_history": {"$exists": True}}},
            {"$unwind": "$review_history"},
            {
                "$group": {
                    "_id": "$review_history.action",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    outcome_counts = {action: 0 for action in REVIEW_ACTIONS}
    other_outcomes = {}

    for row in outcome_rows:
        action = row.get("_id")
        count = row.get("count", 0)

        if action in outcome_counts:
            outcome_counts[action] += count
        elif isinstance(action, str) and action.strip():
            other_outcomes[action] = (
                other_outcomes.get(action, 0) + count
            )

    workload_rows = list(
        complaints_collection.aggregate([
            {"$match": {"review_history": {"$exists": True}}},
            {"$unwind": "$review_history"},
            {
                "$group": {
                    "_id": "$review_history.reviewer_id",
                    "reviewer_name": {
                        "$max": "$review_history.reviewer_name"
                    },
                    "actions": {"$sum": 1},
                    "last_action_at": {
                        "$max": "$review_history.created_at"
                    },
                    "approvals": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$review_history.action",
                                        "Approve",
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "rejections": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$review_history.action",
                                        "Reject",
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
            {"$sort": {"actions": -1}},
        ])
    )

    workload = [
        {
            "reviewer_id": row.get("_id"),
            "reviewer_name": row.get("reviewer_name"),
            "actions": row.get("actions", 0),
            "approvals": row.get("approvals", 0),
            "rejections": row.get("rejections", 0),
            "last_action_at": row.get("last_action_at"),
        }
        for row in workload_rows
        if row.get("_id")
    ]

    recent_activity = []

    for complaint in complaints_collection.find(
        {"review_history": {"$exists": True, "$ne": []}},
        {
            "title": 1,
            "status": 1,
            "review_history": 1,
        },
    ).sort("updated_at", -1).limit(20):
        history = complaint.get("review_history") or []

        for entry in history[-3:]:
            recent_activity.append({
                "complaint_id": str(complaint["_id"]),
                "complaint_title": complaint.get("title", ""),
                "complaint_status": complaint.get("status"),
                "action": entry.get("action"),
                "reviewer_id": entry.get("reviewer_id"),
                "reviewer_name": entry.get("reviewer_name"),
                "comment": entry.get("comment"),
                "created_at": entry.get("created_at"),
            })

    recent_activity.sort(
        key=lambda item: (
            item["created_at"] is None,
            item["created_at"],
        ),
        reverse=True,
    )

    my_statistics = None

    if reviewer and reviewer.get("id"):
        mine = [
            row
            for row in workload
            if row["reviewer_id"] == reviewer["id"]
        ]

        my_statistics = {
            "reviewer_id": reviewer["id"],
            "actions": mine[0]["actions"] if mine else 0,
            "approvals": mine[0]["approvals"] if mine else 0,
            "rejections": mine[0]["rejections"] if mine else 0,
            "last_action_at": (
                mine[0]["last_action_at"] if mine else None
            ),
            "completed_reviews": (
                complaints_collection.count_documents({
                    "review_status": "Completed",
                    "reviewer_id": reviewer["id"],
                })
            ),
        }

    return {
        "generated_at": datetime.now(timezone.utc),
        "pending_reviews": pending,
        "completed_reviews": completed,
        "complaints_with_review_history": flagged_total,
        "outcome_counts": outcome_counts,
        "other_outcome_counts": other_outcomes,
        "total_review_actions": (
            sum(outcome_counts.values())
            + sum(other_outcomes.values())
        ),
        "reviewer_workload": workload,
        "recent_activity": recent_activity[:20],
        "validation": get_validation_statistics(),
        "my_statistics": my_statistics,
    }
