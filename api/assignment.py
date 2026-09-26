from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import users_collection, complaints_collection
from api.audit import create_audit_log


def assign_complaint(
    *,
    complaint_id: str,
    agent_id: str,
    actor: dict
):
    # -------------------------
    # Validate complaint ID
    # -------------------------
    try:
        complaint_object_id = ObjectId(complaint_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    # -------------------------
    # Find complaint
    # -------------------------
    complaint = complaints_collection.find_one({
        "_id": complaint_object_id
    })

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    # -------------------------
    # Prevent Manual Review bypass
    # -------------------------
    if (
        complaint.get("manual_review_required") is True
        or complaint.get("status") == "Manual Review"
        or complaint.get("review_status") == "Pending"
    ):
        raise HTTPException(
            status_code=400,
            detail="This complaint requires reviewer handling before it can be assigned"
        )

    # -------------------------
    # Validate agent ID
    # -------------------------
    try:
        agent_object_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid agent ID"
        )

    # -------------------------
    # Find active Agent
    # -------------------------
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

    # -------------------------
    # Optional department check
    # -------------------------
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

    # -------------------------
    # Update complaint
    # -------------------------
    now = datetime.now(timezone.utc)

    complaints_collection.update_one(
        {
            "_id": complaint_object_id
        },
        {
            "$set": {
                "assigned_to": str(agent_object_id),
                "status": "Assigned",
                "updated_at": now
            }
        }
    )

    # -------------------------
    # Audit
    # -------------------------
    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="Complaint assigned",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_assigned_to": complaint.get("assigned_to"),
            "assigned_to": str(agent_object_id),
            "assigned_agent_name": agent.get("name"),
            "assigned_department": complaint_department,
            "previous_status": complaint.get("status"),
            "new_status": "Assigned"
        }
    )

    return {
        "message": "Complaint assigned successfully",
        "complaint_id": complaint_id,
        "assigned_to": str(agent_object_id),
        "assigned_agent": {
            "id": str(agent_object_id),
            "name": agent.get("name"),
            "email": agent.get("email"),
            "department": agent.get("department")
        },
        "status": "Assigned"
    }