from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import (
    complaints_collection,
    complaint_activity_collection,
)
from api.audit import create_audit_log
from api.activity import create_complaint_activity
from api.analytics import as_utc, build_distribution

_ACTIVITY_TYPE_BY_STATUS = {
    "In Progress": "status",
    "Awaiting Customer": "status",
    "Escalated": "escalated",
}

# ------------------------------------------------------------
# Allowed source states for each agent transition.
#
# The backend validates the CURRENT persisted status before
# performing a transition so duplicate clicks, stale tabs, or
# crafted requests cannot repeat a transition or act on a
# complaint that is already Resolved/Closed/Escalated.
# ------------------------------------------------------------
_ALLOWED_SOURCE_STATUSES = {
    "start": {"Assigned", "Awaiting Customer", "Reopened"},
    "await-customer": {"Assigned", "In Progress"},
    "escalate": {"Assigned", "In Progress", "Awaiting Customer"},
    "resolve": {"Assigned", "In Progress", "Awaiting Customer"},
}


def _require_source_status(
    complaint: dict,
    action_key: str,
):
    allowed = _ALLOWED_SOURCE_STATUSES[action_key]
    current = complaint.get("status")

    if current not in allowed:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot perform this action while the "
                f"complaint status is '{current}'. Allowed "
                f"from: {', '.join(sorted(allowed))}."
            )
        )


def _get_complaint(complaint_id: str):
    try:
        object_id = ObjectId(complaint_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid complaint ID")

    complaint = complaints_collection.find_one({"_id": object_id})

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    return object_id, complaint


def _require_assigned_agent(complaint: dict, agent: dict):
    assigned_to = complaint.get("assigned_to")

    if assigned_to != agent["id"]:
        raise HTTPException(
            status_code=403,
            detail="This complaint is not assigned to you"
        )


def _update_status(
    *,
    complaint_id: str,
    agent: dict,
    next_status: str,
    action: str,
    action_key: str,
    comment: str | None = None
):
    complaint_object_id, complaint = _get_complaint(complaint_id)

    _require_assigned_agent(complaint, agent)
    _require_source_status(complaint, action_key)

    now = datetime.now(timezone.utc)
    previous_status = complaint.get("status")

    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$set": {
                "status": next_status,
                "updated_at": now
            }
        }
    )

    create_audit_log(
        actor_id=agent["id"],
        actor_role=agent["role"],
        action=f"Agent: {action}",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_status": previous_status,
            "new_status": next_status,
            "comment": comment
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type=_ACTIVITY_TYPE_BY_STATUS.get(
            next_status,
            "status"
        ),
        title=f"Agent: {action}",
        description=comment or "",
        actor=agent.get("name", "Agent"),
        actor_role=agent["role"],
        metadata={
            "previous_status": previous_status,
            "new_status": next_status,
        },
    )

    return {
        "message": f"Complaint {action.lower()} successfully",
        "complaint_id": complaint_id,
        "previous_status": previous_status,
        "status": next_status,
        "agent_id": agent["id"]
    }


def start_handling(
    *,
    complaint_id: str,
    agent: dict
):
    return _update_status(
        complaint_id=complaint_id,
        agent=agent,
        next_status="In Progress",
        action="Started handling",
        action_key="start"
    )


def await_customer(
    *,
    complaint_id: str,
    agent: dict,
    comment: str
):
    if not comment:
        raise HTTPException(
            status_code=400,
            detail="Comment is required when awaiting customer"
        )

    result = _update_status(
        complaint_id=complaint_id,
        agent=agent,
        next_status="Awaiting Customer",
        action="Awaiting customer",
        action_key="await-customer",
        comment=comment
    )

    # Persist the customer-facing request on the complaint and
    # record a customer-visible update, distinct from the
    # internal workflow activity written by _update_status.
    complaints_collection.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {"customer_facing_request": comment}}
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="comment",
        title="Support requested additional information",
        description=comment,
        actor=agent.get("name", "Agent"),
        actor_role=agent["role"],
        customer_visible=True,
    )

    return result


def resolve_complaint(
    *,
    complaint_id: str,
    agent: dict,
    comment: str
):
    if not comment:
        raise HTTPException(
            status_code=400,
            detail="Resolution comment is required"
        )

    complaint_object_id, complaint = _get_complaint(complaint_id)

    _require_assigned_agent(complaint, agent)
    _require_source_status(complaint, "resolve")

    now = datetime.now(timezone.utc)
    previous_status = complaint.get("status")

    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$set": {
                "status": "Resolved",
                "resolved_at": now,
                "updated_at": now,
                "resolution_comment": comment
            }
        }
    )

    create_audit_log(
        actor_id=agent["id"],
        actor_role=agent["role"],
        action="Agent: Complaint resolved",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_status": previous_status,
            "new_status": "Resolved",
            "comment": comment
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="resolved",
        title="Agent resolved the complaint",
        description=comment,
        actor=agent.get("name", "Agent"),
        actor_role=agent["role"],
        metadata={"previous_status": previous_status},
        customer_visible=True,
    )

    # --------------------------------------------------------
    # Deterministic lifecycle finalization.
    #
    # The existing lifecycle defines "Closed" as the terminal
    # state after resolution. No customer-confirmation rule
    # exists in the SRS lifecycle, so the system finalizes the
    # complaint immediately and persists the transition —
    # complaints never sit permanently in "Resolved".
    # --------------------------------------------------------
    closed_at = datetime.now(timezone.utc)

    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$set": {
                "status": "Closed",
                "closed_at": closed_at,
                "updated_at": closed_at
            }
        }
    )

    create_audit_log(
        actor_id="system",
        actor_role="System",
        action="Complaint closed",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_status": "Resolved",
            "new_status": "Closed",
            "resolved_by": agent["id"]
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="closed",
        title="Complaint closed",
        description=(
            "Complaint finalized after resolution."
        ),
        metadata={"previous_status": "Resolved"},
        customer_visible=True,
    )

    return {
        "message": "Complaint resolved and closed successfully",
        "complaint_id": complaint_id,
        "status": "Closed",
        "resolved_at": now,
        "closed_at": closed_at
    }


def escalate_complaint(
    *,
    complaint_id: str,
    agent: dict,
    comment: str
):
    if not comment:
        raise HTTPException(
            status_code=400,
            detail="Comment is required when escalating"
        )

    return _update_status(
        complaint_id=complaint_id,
        agent=agent,
        next_status="Escalated",
        action="Escalated complaint",
        action_key="escalate",
        comment=comment
    )


def add_agent_comment(
    *,
    complaint_id: str,
    agent: dict,
    comment: str
):
    if not comment:
        raise HTTPException(
            status_code=400,
            detail="Comment is required"
        )

    complaint_object_id, complaint = _get_complaint(complaint_id)

    _require_assigned_agent(complaint, agent)

    now = datetime.now(timezone.utc)

    comment_entry = {
        "agent_id": agent["id"],
        "agent_name": agent["name"],
        "comment": comment,
        "created_at": now
    }

    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$push": {
                "agent_comments": comment_entry
            },
            "$set": {
                "updated_at": now
            }
        }
    )

    create_audit_log(
        actor_id=agent["id"],
        actor_role=agent["role"],
        action="Agent: Comment added",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "comment": comment
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="note",
        title="Agent added an internal comment",
        description=comment,
        actor=agent.get("name", "Agent"),
        actor_role=agent["role"],
    )

    return {
        "message": "Agent comment added successfully",
        "complaint_id": complaint_id
    }

# ============================================================
# CUSTOMER RESPONSE (Awaiting Customer flow)
#
# The customer-side counterpart of await_customer(): the
# complaint owner answers the agent's customer-facing request.
# Ownership and current status are enforced here — customers
# can never touch assignment, analysis, or any other workflow
# field.
# ============================================================

def customer_respond(
    *,
    complaint_id: str,
    customer: dict,
    message: str
):
    if not message or not message.strip():
        raise HTTPException(
            status_code=400,
            detail="A response message is required"
        )

    message = message.strip()

    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    # Ownership: only the submitting customer may respond.
    if str(complaint.get("user_id")) != str(customer["id"]):
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission to respond to "
                "this complaint"
            )
        )

    # Responses are only valid while the agent is waiting.
    if complaint.get("status") != "Awaiting Customer":
        raise HTTPException(
            status_code=409,
            detail=(
                "This complaint is not awaiting a customer "
                "response"
            )
        )

    now = datetime.now(timezone.utc)

    response_entry = {
        "message": message,
        "customer_id": customer["id"],
        "created_at": now,
    }

    # Persist the response and return the complaint to the
    # assigned agent's active work. assigned_to is untouched.
    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$push": {
                "customer_responses": response_entry
            },
            "$set": {
                "status": "In Progress",
                "updated_at": now
            }
        }
    )

    create_audit_log(
        actor_id=customer["id"],
        actor_role="Customer",
        action="Customer responded",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_status": "Awaiting Customer",
            "new_status": "In Progress"
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="comment",
        title="Customer responded",
        description=message,
        actor=customer.get("name", "Customer"),
        actor_role="Customer",
        metadata={
            "previous_status": "Awaiting Customer",
            "new_status": "In Progress",
        },
        customer_visible=True,
    )

    return {
        "message": "Response submitted successfully",
        "complaint_id": complaint_id,
        "status": "In Progress"
    }


# ============================================================
# AGENT STATISTICS
#
# Read-only aggregations over the agent's own complaints.
#
#   complaints.assigned_to / status / created_at / resolved_at
#   complaint_activity      persisted transition timeline
#
# Handling time is measured from the persisted "In Progress"
# transition recorded by _update_status(), so it is a real
# measurement rather than an estimate. Complaints resolved
# before that event exists are reported as unmeasurable.
# ============================================================

AGENT_OPEN_STATUSES = [
    "Assigned",
    "In Progress",
    "Awaiting Customer",
    "Reopened",
]


def get_agent_statistics(agent: dict):
    """Workload and real handling-time metrics for one agent."""

    agent_id = agent["id"]

    summary_rows = list(
        complaints_collection.aggregate([
            {"$match": {"assigned_to": agent_id}},
            {
                "$group": {
                    "_id": None,
                    "assigned_total": {"$sum": 1},
                    "open": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$in": [
                                        "$status",
                                        AGENT_OPEN_STATUSES,
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "in_progress": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "In Progress"]},
                                1,
                                0,
                            ]
                        }
                    },
                    "awaiting_customer": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$status",
                                        "Awaiting Customer",
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "escalated": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "Escalated"]},
                                1,
                                0,
                            ]
                        }
                    },
                    "closed": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "Closed"]},
                                1,
                                0,
                            ]
                        }
                    },
                    "resolved": {
                        "$sum": {
                            "$cond": [
                                {"$ne": ["$resolved_at", None]},
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ])
    )

    summary = summary_rows[0] if summary_rows else {}

    status_rows = list(
        complaints_collection.aggregate([
            {"$match": {"assigned_to": agent_id}},
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    status_distribution = build_distribution(
        status_rows,
        fallback="Unknown",
    )

    # --------------------------------------------------------
    # Handling time: created_at -> resolved_at (age at
    # resolution) and first "In Progress" -> resolved_at
    # (actual handling time). Both come from stored events.
    # --------------------------------------------------------
    resolved_complaints = list(
        complaints_collection.find(
            {
                "assigned_to": agent_id,
                "resolved_at": {"$ne": None},
            },
            {
                "created_at": 1,
                "resolved_at": 1,
            },
        )
    )

    resolution_hours = []

    for complaint in resolved_complaints:
        created_at = as_utc(complaint.get("created_at"))
        resolved_at = as_utc(complaint.get("resolved_at"))

        if created_at and resolved_at and resolved_at >= created_at:
            resolution_hours.append(
                (resolved_at - created_at).total_seconds() / 3600
            )

    resolved_ids = [
        str(complaint["_id"])
        for complaint in resolved_complaints
    ]

    start_rows = list(
        complaint_activity_collection.aggregate([
            {
                "$match": {
                    "complaint_id": {"$in": resolved_ids},
                    "metadata.new_status": "In Progress",
                }
            },
            {
                "$group": {
                    "_id": "$complaint_id",
                    "started_at": {"$min": "$timestamp"},
                }
            },
        ])
    ) if resolved_ids else []

    started_map = {
        row["_id"]: as_utc(row.get("started_at"))
        for row in start_rows
    }

    handling_hours = []

    for complaint in resolved_complaints:
        started_at = started_map.get(str(complaint["_id"]))
        resolved_at = as_utc(complaint.get("resolved_at"))

        if started_at and resolved_at and resolved_at >= started_at:
            handling_hours.append(
                (resolved_at - started_at).total_seconds() / 3600
            )

    def _average(values):
        if not values:
            return None

        return round(sum(values) / len(values), 2)

    now = datetime.now(timezone.utc)

    open_ages = []

    for complaint in complaints_collection.find(
        {
            "assigned_to": agent_id,
            "status": {"$in": AGENT_OPEN_STATUSES},
        },
        {"created_at": 1},
    ):
        created_at = as_utc(complaint.get("created_at"))

        if created_at:
            open_ages.append(
                (now - created_at).total_seconds() / 3600
            )

    activity_rows = list(
        complaint_activity_collection.find(
            {
                "actor_role": "Agent",
                "complaint_id": {
                    "$in": [
                        str(complaint["_id"])
                        for complaint in complaints_collection.find(
                            {"assigned_to": agent_id},
                            {"_id": 1},
                        )
                    ]
                },
            }
        ).sort("timestamp", -1).limit(10)
    )

    recent_activity = [
        {
            "complaint_id": row.get("complaint_id"),
            "type": row.get("type"),
            "title": row.get("title"),
            "description": row.get("description"),
            "timestamp": row.get("timestamp"),
        }
        for row in activity_rows
    ]

    assigned_total = summary.get("assigned_total", 0)
    resolved_total = summary.get("resolved", 0)

    return {
        "generated_at": now,
        "agent_id": agent_id,
        "assigned_total": assigned_total,
        "open": summary.get("open", 0),
        "in_progress": summary.get("in_progress", 0),
        "awaiting_customer": summary.get("awaiting_customer", 0),
        "escalated": summary.get("escalated", 0),
        "resolved": resolved_total,
        "closed": summary.get("closed", 0),
        "resolution_rate_percent": (
            round((resolved_total / assigned_total) * 100, 2)
            if assigned_total
            else None
        ),
        "status_distribution": status_distribution,
        "average_resolution_hours": _average(resolution_hours),
        "timed_resolutions": len(resolution_hours),
        "average_handling_hours": _average(handling_hours),
        "measured_handling_count": len(handling_hours),
        # Complaints resolved without a stored "In Progress"
        # transition cannot have their handling time measured.
        "handling_time_unavailable": max(
            len(resolved_complaints) - len(handling_hours),
            0,
        ),
        "average_open_age_hours": _average(open_ages),
        "oldest_open_age_hours": (
            round(max(open_ages), 2) if open_ages else None
        ),
        "recent_activity": recent_activity,
    }
