from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException

from api.database import (
    complaints_collection,
    analyses_collection,
    users_collection,
    audit_logs_collection,
    complaint_activity_collection,
)
from api.audit import create_audit_log
from api.activity import create_complaint_activity
from api.sla import get_sla_status
from api.analytics import (
    UNASSIGNED_LABEL,
    analysis_lookup_stages,
    as_utc,
    build_distribution,
    day_series,
    get_resolution_statistics,
    get_validation_statistics,
    query_datetime,
    utc_now,
)


# ============================================================
# HELPERS
# ============================================================

def resolve_user_names(user_ids):
    """
    Map user ids to stored names.

    Audit logs and review history store only the actor id, so
    display names have to be resolved from the users collection.
    Ids without a matching user are simply absent from the map;
    no placeholder name is invented.
    """

    object_ids = []

    for user_id in set(user_ids):
        if not user_id:
            continue

        try:
            object_ids.append(ObjectId(user_id))
        except Exception:
            continue

    if not object_ids:
        return {}

    return {
        str(user["_id"]): user.get("name")
        for user in users_collection.find(
            {"_id": {"$in": object_ids}},
            {"name": 1},
        )
    }


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
    assigned_to: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    limit: int = 25,
):
    """
    Server-side filtered, paginated management complaint list.

    Role authorisation is unchanged: the route still requires
    Manager or Admin, and this function applies no implicit
    visibility rules of its own.

    `category` is stored on the analysis document, so it is
    applied through a `$lookup` join rather than a made-up
    complaint field.
    """

    page = max(int(page), 1)
    limit = min(max(int(limit), 1), 200)

    match: dict = {}

    if status:
        match["status"] = status

    if department:
        match["assigned_department"] = department

    if assigned_to:
        match["assigned_to"] = assigned_to

    if priority:
        match["priority"] = priority

    created_range = {}

    parsed_from = parse_date(date_from)
    parsed_to = parse_date(date_to)

    if parsed_from:
        created_range["$gte"] = parsed_from

    if parsed_to:
        if parsed_to.hour == 0 and parsed_to.minute == 0:
            parsed_to = parsed_to + timedelta(days=1)

        created_range["$lt"] = parsed_to

    if created_range:
        match["created_at"] = created_range

    if search:
        pattern = {
            "$regex": str(search).strip(),
            "$options": "i",
        }

        match["$or"] = [
            {"title": pattern},
            {"description": pattern},
            {"order_id": pattern},
            {"transaction_id": pattern},
        ]

    pipeline = []

    if match:
        pipeline.append({"$match": match})

    pipeline.extend(analysis_lookup_stages())

    if category:
        pipeline.append({
            "$match": {
                "analysis.classification.category": category
            }
        })

    pipeline.append({"$sort": {"created_at": -1}})

    facet = list(
        complaints_collection.aggregate([
            *pipeline,
            {
                "$facet": {
                    "rows": [
                        {"$skip": (page - 1) * limit},
                        {"$limit": limit},
                    ],
                    "total": [{"$count": "count"}],
                }
            },
        ])
    )

    result = facet[0] if facet else {}
    rows = result.get("rows") or []
    total_rows = result.get("total") or []
    total = total_rows[0]["count"] if total_rows else 0

    complaints = []

    for complaint in rows:
        analysis = complaint.get("analysis") or {}
        classification = analysis.get("classification") or {}
        escalation = analysis.get("escalation") or {}

        serialized = _serialize_complaint(complaint)

        serialized.update({
            "category": classification.get("category"),
            "subcategory": classification.get("subcategory"),
            "priority": complaint.get("priority"),
            "sla_hours": complaint.get("sla_hours"),
            "sla_due_at": complaint.get("sla_due_at"),
            "escalation_level": escalation.get("level"),
        })

        complaints.append(serialized)

    return {
        "count": len(complaints),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total else 0,
        "has_more": page * limit < total,
        "filters": {
            "status": status,
            "department": department,
            "assigned_to": assigned_to,
            "category": category,
            "priority": priority,
            "search": search,
            "date_from": date_from,
            "date_to": date_to,
        },
        "available_statuses": sorted(
            value
            for value in complaints_collection.distinct("status")
            if value
        ),
        "available_departments": sorted(
            value
            for value in complaints_collection.distinct(
                "assigned_department"
            )
            if value
        ),
        "available_categories": sorted(
            value
            for value in analyses_collection.distinct(
                "analysis.classification.category"
            )
            if value
        ),
        "available_priorities": sorted(
            value
            for value in complaints_collection.distinct("priority")
            if value
        ),
        "complaints": complaints,
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
    """
    Currently escalated complaints with their real escalation
    context and aggregate statistics.

    Context comes from two persisted sources only:

        analyses.analysis.escalation   level / reason / rules
        complaint_activity type=escalated
                                        when and by whom

    Complaints escalated before activity logging existed have no
    escalation timestamp; that is reported, never estimated.
    """

    complaints = list(
        complaints_collection.find({
            "status": "Escalated"
        }).sort("updated_at", -1)
    )

    complaint_ids = [str(c["_id"]) for c in complaints]

    analyses = {
        document["complaint_id"]: document.get("analysis") or {}
        for document in analyses_collection.find({
            "complaint_id": {"$in": complaint_ids}
        })
    } if complaint_ids else {}

    escalation_events = {}

    if complaint_ids:
        for event in complaint_activity_collection.find({
            "complaint_id": {"$in": complaint_ids},
            "type": "escalated",
        }).sort("timestamp", 1):
            escalation_events.setdefault(
                event["complaint_id"],
                event,
            )

    now = utc_now()

    escalations = []
    level_counts = {}
    department_counts = {}
    reason_counts = {}
    open_hours = []
    missing_timestamp = 0

    for complaint in complaints:
        complaint_id = str(complaint["_id"])

        analysis = analyses.get(complaint_id, {})
        escalation = analysis.get("escalation") or {}
        event = escalation_events.get(complaint_id)

        escalated_at = as_utc(
            event.get("timestamp") if event else None
        )

        if escalated_at:
            open_hours.append(
                (now - escalated_at).total_seconds() / 3600
            )
        else:
            missing_timestamp += 1

        level = escalation.get("level") or "Not recorded"
        level_counts[level] = level_counts.get(level, 0) + 1

        department = (
            complaint.get("assigned_department")
            or UNASSIGNED_LABEL
        )
        department_counts[department] = (
            department_counts.get(department, 0) + 1
        )

        reason = escalation.get("reason")

        if reason:
            reason_counts[reason] = (
                reason_counts.get(reason, 0) + 1
            )

        serialized = _serialize_complaint(complaint)

        serialized.update({
            "escalation_level": escalation.get("level"),
            "escalation_reason": escalation.get("reason"),
            "escalation_rules": escalation.get("rules") or [],
            "escalation_required": escalation.get("required"),
            "category": (
                (analysis.get("classification") or {}).get(
                    "category"
                )
            ),
            "escalated_at": (
                event.get("timestamp") if event else None
            ),
            "escalated_by": (
                event.get("actor") if event else None
            ),
            "escalated_by_role": (
                event.get("actor_role") if event else None
            ),
            "escalation_note": (
                event.get("description") if event else None
            ),
            "hours_since_escalation": (
                round(
                    (now - escalated_at).total_seconds() / 3600,
                    2,
                )
                if escalated_at
                else None
            ),
        })

        escalations.append(serialized)

    ever_escalated_ids = (
        complaint_activity_collection.distinct(
            "complaint_id",
            {"type": "escalated"},
        )
    )

    resolved_after_escalation = 0

    for complaint_id in ever_escalated_ids:
        try:
            object_id = ObjectId(complaint_id)
        except Exception:
            continue

        if complaints_collection.count_documents({
            "_id": object_id,
            "resolved_at": {"$ne": None},
        }):
            resolved_after_escalation += 1

    def _sorted(counts):
        return dict(
            sorted(
                counts.items(),
                key=lambda item: (-item[1], item[0]),
            )
        )

    return {
        "generated_at": now,
        "count": len(escalations),
        "escalations": escalations,
        "statistics": {
            "currently_escalated": len(escalations),
            "ever_escalated": len(ever_escalated_ids),
            "resolved_after_escalation": (
                resolved_after_escalation
            ),
            "level_distribution": _sorted(level_counts),
            "department_distribution": _sorted(
                department_counts
            ),
            "reason_distribution": _sorted(reason_counts),
            "average_hours_since_escalation": (
                round(sum(open_hours) / len(open_hours), 2)
                if open_hours
                else None
            ),
            "longest_hours_since_escalation": (
                round(max(open_hours), 2)
                if open_hours
                else None
            ),
            "escalation_time_unavailable": missing_timestamp,
        },
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

    # SLA targets come from the rule engine values persisted on
    # the complaint (see api/sla.py). Complaints created before
    # those fields existed are reported as unavailable.
    sla_status = get_sla_status()

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
        ),
        "with_sla_target": sla_status["with_sla_target"],
        "without_sla_target": sla_status["without_sla_target"],
        "coverage_percent": sla_status["coverage_percent"],
        "at_risk_threshold_ratio": sla_status[
            "at_risk_threshold_ratio"
        ],
        "met": sla_status["met"],
        "breached": sla_status["breached"],
        "at_risk": sla_status["at_risk"],
        "on_track": sla_status["on_track"],
        "unavailable": sla_status["unavailable"],
        "compliance_percent": sla_status["compliance_percent"],
        "state_distribution": sla_status["state_distribution"],
        "departments": sla_status["departments"],
        "priorities": sla_status["priorities"],
        "attention": sla_status["attention"],
    }


# ============================================================
# ANALYTICS
# ============================================================

def get_operational_analytics():
    """
    Operational distributions for manager/admin dashboards.

    Every figure comes from a MongoDB aggregation over persisted
    complaint and analysis documents.

    Two historical defects are corrected here:

    * `genai_python_mismatch_count` used to read
      `analysis.validation.genai_python_mismatch`, a key no part
      of the system ever writes, so it was permanently zero. The
      real validation figures are reported instead.

    * escalation severity was reported as "priority". The rule
      engine severity is now returned as
      `escalation_level_distribution`, and `priority_distribution`
      only contains complaints that carry a persisted priority.
    """

    total_complaints = complaints_collection.count_documents({})

    status_rows = list(
        complaints_collection.aggregate([
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    department_rows = list(
        complaints_collection.aggregate([
            {
                "$group": {
                    "_id": {
                        "$ifNull": [
                            "$assigned_department",
                            UNASSIGNED_LABEL,
                        ]
                    },
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    analysis_rows = list(
        complaints_collection.aggregate([
            *analysis_lookup_stages(),
            {
                "$addFields": {
                    "priority_value": {
                        "$ifNull": [
                            "$priority",
                            "$analysis.priority",
                        ]
                    }
                }
            },
            {
                "$facet": {
                    "category": [
                        {
                            "$group": {
                                "_id": (
                                    "$analysis.classification"
                                    ".category"
                                ),
                                "count": {"$sum": 1},
                            }
                        }
                    ],
                    "escalation_level": [
                        {
                            "$group": {
                                "_id": "$analysis.escalation.level",
                                "count": {"$sum": 1},
                            }
                        }
                    ],
                    "priority": [
                        {
                            "$group": {
                                "_id": "$priority_value",
                                "count": {"$sum": 1},
                            }
                        }
                    ],
                    "sentiment": [
                        {
                            "$group": {
                                "_id": "$analysis.sentiment.label",
                                "count": {"$sum": 1},
                            }
                        }
                    ],
                    "escalation_required": [
                        {
                            "$match": {
                                "analysis.escalation.required": True
                            }
                        },
                        {"$count": "count"},
                    ],
                    "analyzed": [
                        {"$match": {"analysis": {"$ne": None}}},
                        {"$count": "count"},
                    ],
                }
            },
        ])
    )

    facets = analysis_rows[0] if analysis_rows else {}

    def _facet_count(name: str) -> int:
        rows = facets.get(name) or []
        return rows[0].get("count", 0) if rows else 0

    priority_rows = facets.get("priority") or []

    priority_distribution = {}
    priority_unavailable = 0

    for row in priority_rows:
        value = row.get("_id")
        count = row.get("count", 0)

        if not isinstance(value, str) or not value.strip():
            priority_unavailable += count
            continue

        priority_distribution[value.strip()] = (
            priority_distribution.get(value.strip(), 0) + count
        )

    analyzed = _facet_count("analyzed")

    return {
        "total_complaints": total_complaints,
        "analyzed_complaints": analyzed,
        "complaints_without_analysis": max(
            total_complaints - analyzed,
            0,
        ),
        "status_distribution": build_distribution(
            status_rows,
            fallback="New",
        ),
        "department_distribution": build_distribution(
            department_rows,
            fallback=UNASSIGNED_LABEL,
        ),
        "category_distribution": build_distribution(
            facets.get("category") or [],
            fallback="Not analyzed",
        ),
        "escalation_level_distribution": build_distribution(
            facets.get("escalation_level") or [],
            fallback="Not analyzed",
        ),
        "sentiment_distribution": build_distribution(
            facets.get("sentiment") or [],
            fallback="Not recorded",
        ),
        "priority_distribution": dict(
            sorted(
                priority_distribution.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ),
        "priority_unavailable_count": priority_unavailable,
        "manual_review_count": (
            complaints_collection.count_documents({
                "manual_review_required": True
            })
        ),
        "manual_review_completed_count": (
            complaints_collection.count_documents({
                "review_status": "Completed"
            })
        ),
        "escalation_count": (
            complaints_collection.count_documents({
                "status": "Escalated"
            })
        ),
        "escalation_required_count": _facet_count(
            "escalation_required"
        ),
        "validation": get_validation_statistics(),
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

def parse_date(value):
    """
    Parse an ISO-8601 date or datetime filter value.

    Returns naive UTC for query use, or None when the value is
    missing or unparseable (an unparseable filter is ignored
    rather than silently returning wrong rows).
    """

    if not value:
        return None

    text = str(value).strip()

    if not text:
        return None

    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None

    return query_datetime(parsed)


def get_audit_logs(
    limit: int = 50,
    *,
    page: int = 1,
    action: str | None = None,
    actor_id: str | None = None,
    actor_role: str | None = None,
    entity_type: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    """
    Paginated audit log.

    Filters map one-to-one onto stored fields. The audit schema
    has no success/failure result, so no such filter exists.
    Actor display names are resolved from the users collection.
    """

    limit = min(max(int(limit), 1), 500)
    page = max(int(page), 1)

    query: dict = {}

    if action:
        query["action"] = action

    if actor_id:
        query["actor_id"] = actor_id

    if actor_role:
        query["actor_role"] = actor_role

    if entity_type:
        query["entity_type"] = entity_type

    created_range = {}

    parsed_from = parse_date(date_from)
    parsed_to = parse_date(date_to)

    if parsed_from:
        created_range["$gte"] = parsed_from

    if parsed_to:
        # An end date without a time covers the whole day.
        if parsed_to.hour == 0 and parsed_to.minute == 0:
            parsed_to = parsed_to + timedelta(days=1)

        created_range["$lt"] = parsed_to

    if created_range:
        query["created_at"] = created_range

    if search:
        pattern = {
            "$regex": str(search).strip(),
            "$options": "i",
        }

        query["$or"] = [
            {"action": pattern},
            {"entity_id": pattern},
            {"entity_type": pattern},
        ]

    total = audit_logs_collection.count_documents(query)

    logs = list(
        audit_logs_collection.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    names = resolve_user_names(
        [log.get("actor_id") for log in logs]
    )

    result = []

    for log in logs:
        actor_id_value = log.get("actor_id")

        result.append({
            "id": str(log["_id"]),
            "actor_id": actor_id_value,
            "actor_name": names.get(actor_id_value),
            "actor_role": log.get("actor_role"),
            "action": log.get("action"),
            "entity_type": log.get("entity_type"),
            "entity_id": log.get("entity_id"),
            "details": log.get("details", {}),
            "created_at": log.get("created_at"),
        })

    return {
        "count": len(result),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total else 0,
        "has_more": page * limit < total,
        "logs": result,
        # The audit schema stores no outcome flag, so a
        # success/failure filter cannot be supported.
        "result_filter_available": False,
        "available_actions": sorted(
            value
            for value in audit_logs_collection.distinct("action")
            if value
        ),
        "available_roles": sorted(
            value
            for value in audit_logs_collection.distinct(
                "actor_role"
            )
            if value
        ),
        "available_entity_types": sorted(
            value
            for value in audit_logs_collection.distinct(
                "entity_type"
            )
            if value
        ),
    }


# ============================================================
# AUDIT SUMMARY
#
# Aggregated view of api/audit.py records. The audit schema is
# actor_id / actor_role / action / entity_type / entity_id /
# details / created_at, so anything outside those fields (for
# example a success-or-failure result) cannot be reported.
# ============================================================

def get_audit_summary(days: int = 30):
    days = min(max(int(days), 1), 365)

    now = utc_now()

    window_start = query_datetime(
        now.replace(hour=0, minute=0, second=0, microsecond=0)
        - timedelta(days=days - 1)
    )

    total_logs = audit_logs_collection.count_documents({})

    window_match = {"created_at": {"$gte": window_start}}

    action_rows = list(
        audit_logs_collection.aggregate([
            {"$match": window_match},
            {
                "$group": {
                    "_id": "$action",
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"count": -1}},
        ])
    )

    role_rows = list(
        audit_logs_collection.aggregate([
            {"$match": window_match},
            {
                "$group": {
                    "_id": "$actor_role",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    entity_rows = list(
        audit_logs_collection.aggregate([
            {"$match": window_match},
            {
                "$group": {
                    "_id": "$entity_type",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    actor_rows = list(
        audit_logs_collection.aggregate([
            {"$match": window_match},
            {
                "$group": {
                    "_id": "$actor_id",
                    "count": {"$sum": 1},
                    "last_action_at": {"$max": "$created_at"},
                }
            },
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ])
    )

    daily_rows = list(
        audit_logs_collection.aggregate([
            {"$match": window_match},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at",
                        }
                    },
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    daily_map = {
        row["_id"]: row["count"]
        for row in daily_rows
        if row.get("_id")
    }

    series = [
        {"date": day, "count": daily_map.get(day, 0)}
        for day in day_series(window_start, days)
    ]

    names = resolve_user_names(
        [row.get("_id") for row in actor_rows]
    )

    top_actors = [
        {
            "actor_id": row.get("_id"),
            "actor_name": names.get(row.get("_id")),
            "actions": row.get("count", 0),
            "last_action_at": row.get("last_action_at"),
        }
        for row in actor_rows
        if row.get("_id")
    ]

    latest = list(
        audit_logs_collection.find({})
        .sort("created_at", -1)
        .limit(1)
    )

    return {
        "generated_at": now,
        "days": days,
        "total_logs": total_logs,
        "logs_in_window": sum(
            row.get("count", 0) for row in action_rows
        ),
        "action_distribution": build_distribution(action_rows),
        "actor_role_distribution": build_distribution(role_rows),
        "entity_type_distribution": build_distribution(
            entity_rows
        ),
        "top_actors": top_actors,
        "daily_activity": series,
        "last_activity_at": (
            latest[0].get("created_at") if latest else None
        ),
    }


# ============================================================
# ADMIN STATISTICS
#
# System-wide view for the administrator home surface. It is a
# composition of the existing aggregations plus user and audit
# figures; no metric is computed twice in two different ways.
# ============================================================

def get_admin_statistics():
    analytics = get_operational_analytics()
    resolution = get_resolution_statistics()
    users = get_user_overview()
    audit = get_audit_summary(days=30)

    departments_with_users = users_collection.distinct("department")

    return {
        "generated_at": utc_now(),
        "complaints": {
            "total": analytics["total_complaints"],
            "analyzed": analytics["analyzed_complaints"],
            "without_analysis": analytics[
                "complaints_without_analysis"
            ],
            "open": resolution["open_complaints"],
            "resolved": resolution["resolved_complaints"],
            "closed": resolution["closed_complaints"],
            "escalated": analytics["escalation_count"],
            "manual_review": analytics["manual_review_count"],
            "manual_review_completed": analytics[
                "manual_review_completed_count"
            ],
            "status_distribution": analytics[
                "status_distribution"
            ],
            "category_distribution": analytics[
                "category_distribution"
            ],
            "department_distribution": analytics[
                "department_distribution"
            ],
            "escalation_level_distribution": analytics[
                "escalation_level_distribution"
            ],
        },
        "resolution": {
            "average_resolution_hours": resolution[
                "average_resolution_hours"
            ],
            "median_resolution_hours": resolution[
                "median_resolution_hours"
            ],
            "resolution_rate_percent": resolution[
                "resolution_rate_percent"
            ],
            "timed_resolutions": resolution["timed_resolutions"],
            "resolution_time_unavailable": resolution[
                "resolution_time_unavailable"
            ],
        },
        "validation": analytics["validation"],
        "users": {
            "total": users["total_users"],
            "role_distribution": users["role_distribution"],
            "status_distribution": users["status_distribution"],
            "departments": sorted(
                department
                for department in departments_with_users
                if department
            ),
        },
        "audit": audit,
    }
