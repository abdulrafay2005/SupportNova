"""
SLA computation for SupportNova.

The rule engine (`ml/rule_engine.py`) already derives a real
`priority` and `sla_hours` for every complaint. Those two values
are persisted on the complaint document at submission time (see
`api/main.py`), together with the derived `sla_due_at`.

This module only READS those fields:

    complaints.sla_hours    target window in hours (rule engine)
    complaints.sla_due_at   created_at + sla_hours
    complaints.resolved_at  real resolution timestamp

No target is invented here. Complaints created before SLA data
was persisted have no `sla_due_at`, and they are reported as
"Unavailable" instead of being back-filled with a guess.
"""

from datetime import timedelta

from api.database import complaints_collection
from api.analytics import (
    CLOSED_STATUSES,
    UNASSIGNED_LABEL,
    as_utc,
    build_distribution,
    query_datetime,
    utc_now,
)


# A complaint is "at risk" once 80% of its own SLA window has
# elapsed, i.e. 20% or less of the window remains. The ratio is
# always reported alongside the numbers so the definition is
# visible instead of hidden.
AT_RISK_THRESHOLD_RATIO = 0.2

STATE_MET = "Met"
STATE_BREACHED = "Breached"
STATE_AT_RISK = "At risk"
STATE_ON_TRACK = "On track"
STATE_UNAVAILABLE = "Unavailable"


def sla_state_expression(now):
    """
    Aggregation expression classifying one complaint's SLA state.

    Only stored values are used: `sla_due_at`, `sla_hours`,
    `resolved_at` and `status`.
    """

    naive_now = query_datetime(now)

    remaining_ms = {"$subtract": ["$sla_due_at", naive_now]}

    at_risk_ms = {
        "$multiply": [
            {"$ifNull": ["$sla_hours", 0]},
            3_600_000 * AT_RISK_THRESHOLD_RATIO,
        ]
    }

    return {
        "$cond": [
            {"$eq": [{"$ifNull": ["$sla_due_at", None]}, None]},
            STATE_UNAVAILABLE,
            {
                "$cond": [
                    {"$ne": [{"$ifNull": ["$resolved_at", None]}, None]},
                    {
                        "$cond": [
                            {"$lte": ["$resolved_at", "$sla_due_at"]},
                            STATE_MET,
                            STATE_BREACHED,
                        ]
                    },
                    {
                        "$cond": [
                            {"$in": ["$status", CLOSED_STATUSES]},
                            STATE_UNAVAILABLE,
                            {
                                "$cond": [
                                    {"$lte": [remaining_ms, 0]},
                                    STATE_BREACHED,
                                    {
                                        "$cond": [
                                            {
                                                "$lte": [
                                                    remaining_ms,
                                                    at_risk_ms,
                                                ]
                                            },
                                            STATE_AT_RISK,
                                            STATE_ON_TRACK,
                                        ]
                                    },
                                ]
                            },
                        ]
                    },
                ]
            },
        ]
    }


def _state_stages(now):
    return [
        {
            "$addFields": {
                "sla_state": sla_state_expression(now),
                "department_key": {
                    "$ifNull": [
                        "$assigned_department",
                        UNASSIGNED_LABEL,
                    ]
                },
            }
        }
    ]


def get_sla_status(*, limit: int = 25):
    """
    SLA coverage, states, department breakdown and the cases that
    need attention.
    """

    now = utc_now()

    total = complaints_collection.count_documents({})

    with_target = complaints_collection.count_documents({
        "sla_due_at": {"$ne": None}
    })

    state_rows = list(
        complaints_collection.aggregate([
            *_state_stages(now),
            {
                "$group": {
                    "_id": "$sla_state",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    states = build_distribution(state_rows)

    department_rows = list(
        complaints_collection.aggregate([
            *_state_stages(now),
            {
                "$group": {
                    "_id": {
                        "department": "$department_key",
                        "state": "$sla_state",
                    },
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    departments = {}

    for row in department_rows:
        key = row.get("_id") or {}
        department = key.get("department") or UNASSIGNED_LABEL
        state = key.get("state") or STATE_UNAVAILABLE

        entry = departments.setdefault(
            department,
            {
                "department": department,
                "total": 0,
                STATE_MET: 0,
                STATE_BREACHED: 0,
                STATE_AT_RISK: 0,
                STATE_ON_TRACK: 0,
                STATE_UNAVAILABLE: 0,
            },
        )

        entry["total"] += row.get("count", 0)
        entry[state] = entry.get(state, 0) + row.get("count", 0)

    department_rows_out = sorted(
        departments.values(),
        key=lambda item: (-item["total"], item["department"]),
    )

    priority_rows = list(
        complaints_collection.aggregate([
            *_state_stages(now),
            {"$match": {"sla_state": {"$ne": STATE_UNAVAILABLE}}},
            {
                "$group": {
                    "_id": {
                        "priority": "$priority",
                        "state": "$sla_state",
                    },
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    priorities = {}

    for row in priority_rows:
        key = row.get("_id") or {}
        priority = key.get("priority") or "Not recorded"
        state = key.get("state") or STATE_UNAVAILABLE

        entry = priorities.setdefault(
            priority,
            {
                "priority": priority,
                "total": 0,
                STATE_MET: 0,
                STATE_BREACHED: 0,
                STATE_AT_RISK: 0,
                STATE_ON_TRACK: 0,
            },
        )

        entry["total"] += row.get("count", 0)
        entry[state] = entry.get(state, 0) + row.get("count", 0)

    attention_rows = list(
        complaints_collection.aggregate([
            *_state_stages(now),
            {
                "$match": {
                    "sla_state": {
                        "$in": [STATE_BREACHED, STATE_AT_RISK]
                    },
                    "resolved_at": None,
                }
            },
            {"$sort": {"sla_due_at": 1}},
            {"$limit": max(int(limit), 1)},
        ])
    )

    attention = []

    for complaint in attention_rows:
        due_at = as_utc(complaint.get("sla_due_at"))

        attention.append({
            "id": str(complaint["_id"]),
            "title": complaint.get("title"),
            "status": complaint.get("status"),
            "assigned_department": complaint.get(
                "assigned_department"
            ),
            "assigned_to": complaint.get("assigned_to"),
            "priority": complaint.get("priority"),
            "sla_hours": complaint.get("sla_hours"),
            "sla_due_at": complaint.get("sla_due_at"),
            "sla_state": complaint.get("sla_state"),
            "hours_remaining": (
                round((due_at - now).total_seconds() / 3600, 2)
                if due_at
                else None
            ),
        })

    resolved_with_target = (
        states.get(STATE_MET, 0) + states.get(STATE_BREACHED, 0)
    )

    return {
        "generated_at": now,
        "at_risk_threshold_ratio": AT_RISK_THRESHOLD_RATIO,
        "total_complaints": total,
        "with_sla_target": with_target,
        "without_sla_target": max(total - with_target, 0),
        "coverage_percent": (
            round((with_target / total) * 100, 2) if total else None
        ),
        "state_distribution": states,
        "met": states.get(STATE_MET, 0),
        "breached": states.get(STATE_BREACHED, 0),
        "at_risk": states.get(STATE_AT_RISK, 0),
        "on_track": states.get(STATE_ON_TRACK, 0),
        "unavailable": states.get(STATE_UNAVAILABLE, 0),
        "compliance_percent": (
            round(
                (states.get(STATE_MET, 0) / resolved_with_target)
                * 100,
                2,
            )
            if resolved_with_target
            else None
        ),
        "departments": department_rows_out,
        "priorities": sorted(
            priorities.values(),
            key=lambda item: (-item["total"], item["priority"]),
        ),
        "attention": attention,
    }


def build_sla_fields(*, created_at, sla_hours):
    """
    Derive the persisted SLA fields for a new complaint.

    Returns an empty dict when the rule engine produced no usable
    `sla_hours`, so nothing is written unless a real target
    exists.
    """

    try:
        hours = float(sla_hours)
    except (TypeError, ValueError):
        return {}

    if hours <= 0:
        return {}

    reference = as_utc(created_at)

    if reference is None:
        return {}

    return {
        "sla_hours": hours,
        "sla_due_at": reference + timedelta(hours=hours),
    }
