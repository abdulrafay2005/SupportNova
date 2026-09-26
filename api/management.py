from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import (
    complaints_collection,
    analyses_collection,
    users_collection,
    audit_logs_collection,
)
from api.audit import create_audit_log
from api.activity import create_complaint_activity


# ============================================================
# HELPERS
# ============================================================

def _object_id(value: str, field_name: str = "ID"):
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}"
        )


def _get_complaint(complaint_id: str):
    object_id = _object_id(
        complaint_id,
        "complaint ID"
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


def _serialize_complaint(complaint: dict):
    return {
        "id": str(complaint["_id"]),
        "title": complaint.get("title"),
        "description": complaint.get("description"),
        "customer_id": complaint.get("customer_id"),
        "status": complaint.get("status"),
        "assigned_to": complaint.get("assigned_to"),
        "assigned_department": complaint.get(
            "assigned_department"
        ),
        "manual_review_required": complaint.get(
            "manual_review_required",
            False
        ),
        "review_status": complaint.get(
            "review_status"
        ),
        "reviewer_id": complaint.get(
            "reviewer_id"
        ),
        "created_at": complaint.get(
            "created_at"
        ),
        "updated_at": complaint.get(
            "updated_at"
        ),
        "resolved_at": complaint.get(
            "resolved_at"
        ),
        "closed_at": complaint.get(
            "closed_at"
        ),
        "reopened_at": complaint.get(
            "reopened_at"
        ),
    }


# ============================================================
# COMPLAINT MANAGEMENT
# ============================================================

def get_management_complaints(
    *,
    status: str | None = None,
    department: str | None = None,
    assigned_to: str | None = None
):
    query = {}

    if status:
        query["status"] = status

    if department:
        query["assigned_department"] = department

    if assigned_to:
        query["assigned_to"] = assigned_to

    complaints = list(
        complaints_collection.find(query)
        .sort("created_at", -1)
    )

    return {
        "count": len(complaints),
        "complaints": [
            _serialize_complaint(c)
            for c in complaints
        ]
    }


def get_management_complaint(
    complaint_id: str
):
    _, complaint = _get_complaint(
        complaint_id
    )

    analysis_document = analyses_collection.find_one({
        "complaint_id": complaint_id
    })

    analysis = (
        analysis_document.get("analysis")
        if analysis_document
        else None
    )

    return {
        "complaint": _serialize_complaint(
            complaint
        ),
        "analysis": analysis,
        "review_history": complaint.get(
            "review_history",
            []
        ),
        "agent_comments": complaint.get(
            "agent_comments",
            []
        ),
    }


# ============================================================
# ESCALATIONS
# ============================================================

def get_escalated_complaints():
    complaints = list(
        complaints_collection.find({
            "status": "Escalated"
        }).sort(
            "updated_at",
            -1
        )
    )

    return {
        "count": len(complaints),
        "escalations": [
            _serialize_complaint(c)
            for c in complaints
        ]
    }


# ============================================================
# MANAGER REASSIGNMENT
# ============================================================

def reassign_management_complaint(
    *,
    complaint_id: str,
    agent_id: str,
    actor: dict
):
    complaint_object_id, complaint = _get_complaint(
        complaint_id
    )

    agent_object_id = _object_id(
        agent_id,
        "agent ID"
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

    previous_agent = complaint.get(
        "assigned_to"
    )

    now = datetime.now(timezone.utc)

    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$set": {
                "assigned_to": str(agent_object_id),
                "status": "Assigned",
                "updated_at": now
            }
        }
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="assigned",
        title="Complaint reassigned to Agent",
        description=(
            f"Reassigned to {agent.get('name', 'agent')} by "
            f"{actor.get('name', actor['role'])}."
        ),
        actor=actor.get("name", "SupportNova"),
        actor_role=actor["role"],
        metadata={
            "agent_id": str(agent_object_id),
            "agent_name": agent.get("name"),
            "source": "management",
        },
    )

    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="Complaint reassigned",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_assigned_to": previous_agent,
            "new_assigned_to": str(agent_object_id),
            "agent_name": agent.get("name"),
            "department": agent.get("department"),
            "previous_status": complaint.get(
                "status"
            ),
            "new_status": "Assigned"
        }
    )

    return {
        "message": "Complaint reassigned successfully",
        "complaint_id": complaint_id,
        "assigned_to": str(agent_object_id),
        "agent": {
            "id": str(agent_object_id),
            "name": agent.get("name"),
            "email": agent.get("email"),
            "department": agent.get("department")
        },
        "status": "Assigned"
    }


# ============================================================
# SLA / OPERATIONAL OVERVIEW
# ============================================================

def get_sla_overview():
    now = datetime.now(timezone.utc)

    complaints = list(
        complaints_collection.find({})
    )

    total = len(complaints)
    resolved = 0
    unresolved = 0
    open_count = 0

    resolution_times = []

    for complaint in complaints:
        status = complaint.get("status")

        if status in {
            "Resolved",
            "Closed"
        }:
            resolved += 1

            created_at = complaint.get(
                "created_at"
            )

            resolved_at = complaint.get(
                "resolved_at"
            )

            if created_at and resolved_at:
                try:
                    seconds = (
                        resolved_at - created_at
                    ).total_seconds()

                    if seconds >= 0:
                        resolution_times.append(
                            seconds
                        )
                except Exception:
                    pass

        else:
            unresolved += 1

            if status not in {
                "Resolved",
                "Closed"
            }:
                open_count += 1

    average_resolution_hours = None

    if resolution_times:
        average_resolution_hours = (
            sum(resolution_times)
            / len(resolution_times)
            / 3600
        )

    return {
        "generated_at": now,
        "total_complaints": total,
        "resolved_complaints": resolved,
        "unresolved_complaints": unresolved,
        "open_complaints": open_count,
        "average_resolution_hours": (
            round(
                average_resolution_hours,
                2
            )
            if average_resolution_hours is not None
            else None
        )
    }


# ============================================================
# ANALYTICS
# ============================================================

def get_operational_analytics():
    complaints = list(
        complaints_collection.find({})
    )

    complaint_ids = [
        str(c["_id"])
        for c in complaints
    ]

    analyses = list(
        analyses_collection.find({
            "complaint_id": {
                "$in": complaint_ids
            }
        })
    )

    analysis_map = {
        a["complaint_id"]: a.get(
            "analysis",
            {}
        )
        for a in analyses
    }

    status_distribution = {}
    department_distribution = {}
    category_distribution = {}
    priority_distribution = {}

    manual_review_count = 0
    escalation_count = 0
    mismatch_count = 0

    for complaint in complaints:
        complaint_id = str(
            complaint["_id"]
        )

        analysis = analysis_map.get(
            complaint_id,
            {}
        )

        status = complaint.get(
            "status",
            "Unknown"
        )

        status_distribution[status] = (
            status_distribution.get(
                status,
                0
            ) + 1
        )

        department = complaint.get(
            "assigned_department"
        ) or "Unassigned"

        department_distribution[
            department
        ] = (
            department_distribution.get(
                department,
                0
            ) + 1
        )

        classification = analysis.get(
            "classification",
            {}
        )

        category = classification.get(
            "category"
        ) or "Unknown"

        category_distribution[
            category
        ] = (
            category_distribution.get(
                category,
                0
            ) + 1
        )

        priority = (
            analysis.get("priority")
            or analysis.get(
                "escalation",
                {}
            ).get(
                "level"
            )
            or "Unknown"
        )

        priority_distribution[
            priority
        ] = (
            priority_distribution.get(
                priority,
                0
            ) + 1
        )

        if complaint.get(
            "manual_review_required"
        ) is True:
            manual_review_count += 1

        if status == "Escalated":
            escalation_count += 1

        validation = analysis.get(
            "validation",
            {}
        )

        if (
            isinstance(validation, dict)
            and validation.get(
                "genai_python_mismatch"
            )
        ):
            mismatch_count += 1

    return {
        "total_complaints": len(
            complaints
        ),
        "status_distribution": (
            status_distribution
        ),
        "department_distribution": (
            department_distribution
        ),
        "category_distribution": (
            category_distribution
        ),
        "priority_distribution": (
            priority_distribution
        ),
        "manual_review_count": (
            manual_review_count
        ),
        "escalation_count": (
            escalation_count
        ),
        "genai_python_mismatch_count": (
            mismatch_count
        )
    }


# ============================================================
# REPORT DATA
# ============================================================

def get_report_data():
    analytics = get_operational_analytics()
    sla = get_sla_overview()

    return {
        "generated_at": datetime.now(
            timezone.utc
        ),
        "analytics": analytics,
        "sla": sla
    }


# ============================================================
# USER MANAGEMENT
# ============================================================

def get_users(
    *,
    role: str | None = None,
    status: str | None = None
):
    query = {}

    if role:
        query["role"] = role

    if status:
        query["status"] = status

    users = list(
        users_collection.find(
            query,
            {
                "password": 0
            }
        ).sort(
            "created_at",
            -1
        )
    )

    result = []

    for user in users:
        result.append({
            "id": str(user["_id"]),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "department": user.get(
                "department"
            ),
            "status": user.get(
                "status"
            ),
            "created_at": user.get(
                "created_at"
            )
        })

    return {
        "count": len(result),
        "users": result
    }


def update_user_status(
    *,
    user_id: str,
    status: str,
    actor: dict
):
    if status not in {
        "Active",
        "Inactive"
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid user status"
        )

    user_object_id = _object_id(
        user_id,
        "user ID"
    )

    user = users_collection.find_one({
        "_id": user_object_id
    })

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if str(user["_id"]) == actor["id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own account status"
        )

    previous_status = user.get(
        "status"
    )

    users_collection.update_one(
        {"_id": user_object_id},
        {
            "$set": {
                "status": status
            }
        }
    )

    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="User status updated",
        entity_type="user",
        entity_id=user_id,
        details={
            "previous_status": previous_status,
            "new_status": status
        }
    )

    return {
        "message": "User status updated successfully",
        "user_id": user_id,
        "status": status
    }


# ============================================================
# USER OVERVIEW
# ============================================================

def get_user_overview():
    users = list(
        users_collection.find(
            {},
            {
                "password": 0
            }
        )
    )

    role_distribution = {}
    status_distribution = {}

    for user in users:
        role = user.get(
            "role",
            "Unknown"
        )

        status = user.get(
            "status",
            "Unknown"
        )

        role_distribution[role] = (
            role_distribution.get(
                role,
                0
            ) + 1
        )

        status_distribution[status] = (
            status_distribution.get(
                status,
                0
            ) + 1
        )

    return {
        "total_users": len(users),
        "role_distribution": (
            role_distribution
        ),
        "status_distribution": (
            status_distribution
        )
    }


# ============================================================
# AUDIT LOGS
# ============================================================

def get_audit_logs(
    limit: int = 100
):
    limit = min(
        max(limit, 1),
        500
    )

    logs = list(
        audit_logs_collection.find({})
        .sort(
            "created_at",
            -1
        )
        .limit(limit)
    )

    result = []

    for log in logs:
        result.append({
            "id": str(log["_id"]),
            "actor_id": log.get(
                "actor_id"
            ),
            "actor_role": log.get(
                "actor_role"
            ),
            "action": log.get(
                "action"
            ),
            "entity_type": log.get(
                "entity_type"
            ),
            "entity_id": log.get(
                "entity_id"
            ),
            "details": log.get(
                "details",
                {}
            ),
            "created_at": log.get(
                "created_at"
            )
        })

    return {
        "count": len(result),
        "logs": result
    }