from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import complaints_collection
from api.audit import create_audit_log


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
    comment: str | None = None
):
    complaint_object_id, complaint = _get_complaint(complaint_id)

    _require_assigned_agent(complaint, agent)

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
        action="Started handling"
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

    return _update_status(
        complaint_id=complaint_id,
        agent=agent,
        next_status="Awaiting Customer",
        action="Awaiting customer",
        comment=comment
    )


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

    return {
        "message": "Complaint resolved successfully",
        "complaint_id": complaint_id,
        "status": "Resolved",
        "resolved_at": now
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

    return {
        "message": "Agent comment added successfully",
        "complaint_id": complaint_id
    }