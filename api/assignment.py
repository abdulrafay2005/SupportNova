from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import users_collection, complaints_collection
from api.audit import create_audit_log
from api.activity import create_complaint_activity

OPEN_STATUSES = {
    "New",
    "Analyzed",
    "Assigned",
    "In Progress",
    "Awaiting Customer",
    "Escalated",
    "Reopened",
}


def _pick_least_loaded_agent(candidates: list) -> dict | None:
    """Choose the active agent with the fewest open complaints."""
    best = None
    best_load = None

    for agent in candidates:
        load = complaints_collection.count_documents({
            "assigned_to": str(agent["_id"]),
            "status": {"$in": list(OPEN_STATUSES)},
        })

        if best is None or load < best_load:
            best = agent
            best_load = load

    return best


def auto_assign_complaint(
    *,
    complaint_object_id,
    complaint_id: str,
    department: str | None,
) -> dict | None:
    """
    Automatic routing for complaints that do NOT require manual
    review: pick an active Agent (department match preferred,
    least-loaded), persist the assignment, and record the
    activity + audit trail.

    Returns the assigned agent document, or None when no active
    agent exists (the complaint then stays unassigned and awaits
    manual assignment — nothing is fabricated).
    """
    # --------------------------------------------------------
    # Department routing is authoritative.
    #
    # When the classification engine determined a department, the
    # complaint may ONLY go to an active agent of that department.
    # It is never handed to an agent of another department: an
    # unassigned complaint with an honest "awaiting manual
    # assignment" activity is correct, a wrong-department owner is
    # not. The cross-department search is kept only for complaints
    # that carry no department at all.
    # --------------------------------------------------------
    if department:
        candidates = list(users_collection.find({
            "role": "Agent",
            "status": "Active",
            "department": department,
        }))
        source = "automatic-department-match"
    else:
        candidates = list(users_collection.find({
            "role": "Agent",
            "status": "Active",
        }))
        source = "automatic-any-active-agent"

    agent = _pick_least_loaded_agent(candidates)

    if not agent:
        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="routed",
            title="Awaiting manual assignment",
            description=(
                f"No active agent is available in "
                f"{department}."
                if department
                else (
                    "No active agent was available for automatic "
                    "assignment."
                )
            ),
            metadata={"department": department},
        )
        return None

    now = datetime.now(timezone.utc)
    agent_id = str(agent["_id"])

    complaints_collection.update_one(
        {"_id": complaint_object_id},
        {
            "$set": {
                "assigned_to": agent_id,
                "status": "Assigned",
                "updated_at": now,
            }
        },
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="assigned",
        title="Complaint assigned to Agent",
        description=(
            f"Assigned to {agent.get('name', 'agent')} "
            f"({agent.get('department') or 'no department'})."
        ),
        metadata={
            "agent_id": agent_id,
            "agent_name": agent.get("name"),
            "source": source,
        },
    )

    create_audit_log(
        actor_id="system",
        actor_role="System",
        action="Complaint assigned",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "assigned_to": agent_id,
            "assigned_agent_name": agent.get("name"),
            "source": source,
        },
    )

    return agent


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
    # Activity + Audit
    # -------------------------
    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="assigned",
        title="Complaint reassigned to Agent",
        description=(
            f"Assigned to {agent.get('name', 'agent')} by "
            f"{actor.get('name', actor['role'])}."
        ),
        actor=actor.get("name", "SupportNova"),
        actor_role=actor["role"],
        metadata={
            "agent_id": str(agent_object_id),
            "agent_name": agent.get("name"),
            "source": "manual",
        },
    )

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