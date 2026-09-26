"""
Read-only analytics aggregations for SupportNova dashboards.

Every figure returned by this module is produced by a real
MongoDB aggregation over data that the existing complaint
workflow already persists:

    complaints          status / department / assignment /
                        created_at / resolved_at / closed_at
    analyses            classification / sentiment / escalation /
                        policies / validation
    complaint_activity  persisted workflow timeline events

Nothing in this module writes to the database and nothing here
participates in the complaint → analysis → validation → review →
agent workflow. When a value cannot be derived from stored data
it is reported as unavailable (None / explicit counter) instead
of being estimated.
"""

from datetime import datetime, timedelta, timezone

from api.database import (
    complaints_collection,
    analyses_collection,
    complaint_activity_collection,
)


# ============================================================
# CONSTANTS
# ============================================================

OPEN_STATUSES = [
    "New",
    "Analyzed",
    "Assigned",
    "In Progress",
    "Awaiting Customer",
    "Escalated",
    "Reopened",
    "Manual Review",
]

CLOSED_STATUSES = [
    "Resolved",
    "Closed",
]

UNKNOWN_LABEL = "Unknown"
UNASSIGNED_LABEL = "Unassigned"


# ============================================================
# HELPERS
# ============================================================

def utc_now():
    return datetime.now(timezone.utc)


def as_utc(value):
    """Normalise stored datetimes (pymongo returns naive UTC)."""

    if not isinstance(value, datetime):
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def query_datetime(value):
    """
    Normalise a datetime for use inside a query or pipeline.

    MongoDB stores BSON dates in UTC and pymongo returns them as
    naive UTC datetimes, so comparison values must be naive UTC
    too. Response payloads keep timezone-aware values.
    """

    normalised = as_utc(value)

    if normalised is None:
        return None

    return normalised.replace(tzinfo=None)


def _hours(milliseconds):
    if milliseconds is None:
        return None

    return round(milliseconds / 3_600_000, 2)


def _median(values: list):
    if not values:
        return None

    ordered = sorted(values)
    middle = len(ordered) // 2

    if len(ordered) % 2 == 1:
        return ordered[middle]

    return (ordered[middle - 1] + ordered[middle]) / 2


def build_distribution(rows, *, fallback=UNKNOWN_LABEL):
    """Convert `[{_id: x, count: n}]` into an ordered dictionary."""

    distribution = {}

    for row in rows:
        key = row.get("_id")

        if key is None or (isinstance(key, str) and not key.strip()):
            key = fallback

        distribution[str(key)] = distribution.get(str(key), 0) + row.get(
            "count",
            0,
        )

    return dict(
        sorted(
            distribution.items(),
            key=lambda item: (-item[1], item[0]),
        )
    )


def analysis_lookup_stages():
    """
    Attach the persisted analysis document to each complaint.

    `analyses.complaint_id` stores the complaint ObjectId as a
    string, so the complaint `_id` is converted before the join.
    """

    return [
        {
            "$addFields": {
                "complaint_key": {
                    "$toString": "$_id"
                }
            }
        },
        {
            "$lookup": {
                "from": "analyses",
                "localField": "complaint_key",
                "foreignField": "complaint_id",
                "as": "analysis_documents",
            }
        },
        {
            "$addFields": {
                "analysis": {
                    "$ifNull": [
                        {
                            "$arrayElemAt": [
                                "$analysis_documents.analysis",
                                0,
                            ]
                        },
                        None,
                    ]
                }
            }
        },
    ]


def build_complaint_match(
    *,
    status: str | None = None,
    department: str | None = None,
    assigned_to: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict:
    """Shared complaint filter used by analytics and reports."""

    match: dict = {}

    if status:
        match["status"] = status

    if department:
        match["assigned_department"] = department

    if assigned_to:
        match["assigned_to"] = assigned_to

    created_range = {}

    if date_from:
        created_range["$gte"] = date_from

    if date_to:
        created_range["$lte"] = date_to

    if created_range:
        match["created_at"] = created_range

    return match


def _day_key(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def day_series(start: datetime, days: int) -> list:
    return [
        _day_key(start + timedelta(days=offset))
        for offset in range(days)
    ]


# ============================================================
# TRENDS
# ============================================================

def get_complaint_trends(
    *,
    days: int = 30,
    department: str | None = None,
):
    """
    Daily complaint volume derived from real timestamps.

    created    -> complaints.created_at
    resolved   -> complaints.resolved_at
    escalated  -> complaint_activity documents of type "escalated"

    Days without activity are reported as 0 because the absence
    of documents is itself real information.
    """

    days = min(max(int(days), 1), 365)

    now = utc_now()

    window_start = (
        now.replace(hour=0, minute=0, second=0, microsecond=0)
        - timedelta(days=days - 1)
    )

    window_start_query = query_datetime(window_start)

    department_filter = (
        {"assigned_department": department}
        if department
        else {}
    )

    created_rows = list(
        complaints_collection.aggregate([
            {
                "$match": {
                    **department_filter,
                    "created_at": {"$gte": window_start_query},
                }
            },
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

    resolved_rows = list(
        complaints_collection.aggregate([
            {
                "$match": {
                    **department_filter,
                    "resolved_at": {
                        "$ne": None,
                        "$gte": window_start_query,
                    },
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$resolved_at",
                        }
                    },
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    escalation_match: dict = {
        "type": "escalated",
        "timestamp": {"$gte": window_start_query},
    }

    if department:
        department_ids = [
            str(document["_id"])
            for document in complaints_collection.find(
                {"assigned_department": department},
                {"_id": 1},
            )
        ]

        escalation_match["complaint_id"] = {
            "$in": department_ids
        }

    escalated_rows = list(
        complaint_activity_collection.aggregate([
            {"$match": escalation_match},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$timestamp",
                        }
                    },
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    created_map = {
        row["_id"]: row["count"]
        for row in created_rows
        if row.get("_id")
    }

    resolved_map = {
        row["_id"]: row["count"]
        for row in resolved_rows
        if row.get("_id")
    }

    escalated_map = {
        row["_id"]: row["count"]
        for row in escalated_rows
        if row.get("_id")
    }

    points = []

    for day in day_series(window_start, days):
        points.append({
            "date": day,
            "created": created_map.get(day, 0),
            "resolved": resolved_map.get(day, 0),
            "escalated": escalated_map.get(day, 0),
        })

    undated = complaints_collection.count_documents({
        **department_filter,
        "created_at": None,
    })

    return {
        "generated_at": now,
        "days": days,
        "department": department,
        "start_date": _day_key(window_start),
        "end_date": _day_key(now),
        "points": points,
        # Complaints with no stored created_at cannot be placed
        # on the timeline and are reported instead of guessed.
        "undated_complaints": undated,
        "totals": {
            "created": sum(p["created"] for p in points),
            "resolved": sum(p["resolved"] for p in points),
            "escalated": sum(p["escalated"] for p in points),
        },
    }


# ============================================================
# DEPARTMENT PERFORMANCE
# ============================================================

def get_department_performance():
    """
    Per-department workload and resolution timing.

    `resolved` counts complaints with a persisted `resolved_at`
    timestamp, because the workflow finalises resolved
    complaints to "Closed" immediately.
    """

    rows = list(
        complaints_collection.aggregate([
            {
                "$addFields": {
                    "department_key": {
                        "$ifNull": [
                            "$assigned_department",
                            UNASSIGNED_LABEL,
                        ]
                    },
                    "resolution_ms": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$ne": ["$resolved_at", None]},
                                    {"$ne": ["$created_at", None]},
                                ]
                            },
                            {
                                "$subtract": [
                                    "$resolved_at",
                                    "$created_at",
                                ]
                            },
                            None,
                        ]
                    },
                }
            },
            {
                "$group": {
                    "_id": "$department_key",
                    "total": {"$sum": 1},
                    "open": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$in": [
                                        "$status",
                                        OPEN_STATUSES,
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
                    "manual_review": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$status",
                                        "Manual Review",
                                    ]
                                },
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
                    "average_resolution_ms": {
                        "$avg": "$resolution_ms"
                    },
                }
            },
            {"$sort": {"total": -1}},
        ])
    )

    departments = []

    for row in rows:
        departments.append({
            "department": row.get("_id") or UNASSIGNED_LABEL,
            "total": row.get("total", 0),
            "open": row.get("open", 0),
            "in_progress": row.get("in_progress", 0),
            "awaiting_customer": row.get("awaiting_customer", 0),
            "escalated": row.get("escalated", 0),
            "manual_review": row.get("manual_review", 0),
            "resolved": row.get("resolved", 0),
            "closed": row.get("closed", 0),
            "average_resolution_hours": _hours(
                row.get("average_resolution_ms")
            ),
            "resolution_rate_percent": (
                round(
                    (row.get("resolved", 0) / row["total"]) * 100,
                    2,
                )
                if row.get("total")
                else None
            ),
        })

    departments.sort(
        key=lambda item: (-item["total"], item["department"])
    )

    return {
        "generated_at": utc_now(),
        "department_count": len(departments),
        "departments": departments,
        "totals": {
            "total": sum(d["total"] for d in departments),
            "open": sum(d["open"] for d in departments),
            "escalated": sum(d["escalated"] for d in departments),
            "resolved": sum(d["resolved"] for d in departments),
            "closed": sum(d["closed"] for d in departments),
        },
    }


# ============================================================
# RESOLUTION STATISTICS
# ============================================================

def get_resolution_statistics():
    """Resolution volume and timing from persisted timestamps."""

    now = utc_now()

    totals = list(
        complaints_collection.aggregate([
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "resolved": {
                        "$sum": {
                            "$cond": [
                                {"$ne": ["$resolved_at", None]},
                                1,
                                0,
                            ]
                        }
                    },
                    "closed": {
                        "$sum": {
                            "$cond": [
                                {"$ne": ["$closed_at", None]},
                                1,
                                0,
                            ]
                        }
                    },
                    "open": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$in": [
                                        "$status",
                                        OPEN_STATUSES,
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "finished_without_timestamp": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$and": [
                                        {
                                            "$in": [
                                                "$status",
                                                CLOSED_STATUSES,
                                            ]
                                        },
                                        {
                                            "$eq": [
                                                "$resolved_at",
                                                None,
                                            ]
                                        },
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ])
    )

    summary = totals[0] if totals else {}

    duration_rows = list(
        complaints_collection.aggregate([
            {
                "$match": {
                    "resolved_at": {"$ne": None},
                    "created_at": {"$ne": None},
                }
            },
            {
                "$addFields": {
                    "resolution_ms": {
                        "$subtract": [
                            "$resolved_at",
                            "$created_at",
                        ]
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "average": {"$avg": "$resolution_ms"},
                    "fastest": {"$min": "$resolution_ms"},
                    "slowest": {"$max": "$resolution_ms"},
                    "values": {"$push": "$resolution_ms"},
                }
            },
        ])
    )

    durations = duration_rows[0] if duration_rows else {}

    values = [
        value
        for value in durations.get("values", [])
        if isinstance(value, (int, float)) and value >= 0
    ]

    total = summary.get("total", 0)
    resolved = summary.get("resolved", 0)

    recent_rows = list(
        complaints_collection.aggregate([
            {
                "$match": {
                    "resolved_at": {
                        "$ne": None,
                        "$gte": query_datetime(now - timedelta(days=30)),
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "last_30_days": {"$sum": 1},
                    "last_7_days": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$gte": [
                                        "$resolved_at",
                                        query_datetime(
                                            now - timedelta(days=7)
                                        ),
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ])
    )

    recent = recent_rows[0] if recent_rows else {}

    return {
        "generated_at": now,
        "total_complaints": total,
        "resolved_complaints": resolved,
        "closed_complaints": summary.get("closed", 0),
        "open_complaints": summary.get("open", 0),
        "resolution_rate_percent": (
            round((resolved / total) * 100, 2)
            if total
            else None
        ),
        "resolved_last_7_days": recent.get("last_7_days", 0),
        "resolved_last_30_days": recent.get("last_30_days", 0),
        "timed_resolutions": len(values),
        # Complaints finished before resolution timestamps were
        # stored: the duration is genuinely unavailable.
        "resolution_time_unavailable": summary.get(
            "finished_without_timestamp",
            0,
        ),
        "average_resolution_hours": _hours(
            durations.get("average")
        ),
        "median_resolution_hours": _hours(_median(values)),
        "fastest_resolution_hours": _hours(
            durations.get("fastest")
        ),
        "slowest_resolution_hours": _hours(
            durations.get("slowest")
        ),
    }


# ============================================================
# SENTIMENT
# ============================================================

def get_sentiment_distribution():
    """
    Sentiment labels recorded by the existing analysis pipeline.

    Complaints without an analysis document, and analyses where
    the AI layer produced no label, are reported separately
    rather than being bucketed as a real sentiment.
    """

    rows = list(
        analyses_collection.aggregate([
            {
                "$group": {
                    "_id": "$analysis.sentiment.label",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    distribution = {}
    unlabelled = 0

    for row in rows:
        label = row.get("_id")
        count = row.get("count", 0)

        if not isinstance(label, str) or not label.strip():
            unlabelled += count
            continue

        key = label.strip().title()
        distribution[key] = distribution.get(key, 0) + count

    distribution = dict(
        sorted(
            distribution.items(),
            key=lambda item: (-item[1], item[0]),
        )
    )

    analyzed = sum(distribution.values()) + unlabelled

    complaint_total = complaints_collection.count_documents({})

    return {
        "generated_at": utc_now(),
        "analyzed_complaints": analyzed,
        "complaints_without_analysis": max(
            complaint_total - analyzed,
            0,
        ),
        "unlabelled_count": unlabelled,
        "distribution": distribution,
        # The existing pipeline never produces an urgency field.
        "urgency_available": False,
    }


# ============================================================
# VALIDATION (PYTHON GROUND-TRUTH vs GENAI OUTPUT)
# ============================================================

def get_validation_statistics():
    """
    Statistics for the independent Python validation layer.

    Source: `analyses.analysis.validation`, written by
    `api.workflow_validation.validate_workflow`, plus the
    `ai_guard` marker written when GenAI output is rejected.

    Field-level GenAI/Python comparison records are NOT stored
    by the current pipeline, so that is reported as unavailable
    instead of being approximated.
    """

    summary_rows = list(
        analyses_collection.aggregate([
            {
                "$group": {
                    "_id": None,
                    "analyzed": {"$sum": 1},
                    "ground_truth_valid": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$analysis.validation"
                                        ".ground_truth_valid",
                                        True,
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "ground_truth_failed": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$analysis.validation"
                                        ".ground_truth_valid",
                                        False,
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "manual_review_required": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$analysis.validation"
                                        ".manual_review_required",
                                        True,
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "passed": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$analysis.validation.status",
                                        "Passed",
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "failed": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$analysis.validation.status",
                                        "Failed",
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "with_issues": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$gt": [
                                        {
                                            "$size": {
                                                "$ifNull": [
                                                    "$analysis"
                                                    ".validation"
                                                    ".issues",
                                                    [],
                                                ]
                                            }
                                        },
                                        0,
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "ai_output_blocked": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$eq": [
                                        "$analysis.ai_guard.blocked",
                                        True,
                                    ]
                                },
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

    issue_code_rows = list(
        analyses_collection.aggregate([
            {"$unwind": "$analysis.validation.issues"},
            {
                "$group": {
                    "_id": "$analysis.validation.issues.code",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    issue_type_rows = list(
        analyses_collection.aggregate([
            {"$unwind": "$analysis.validation.issues"},
            {
                "$group": {
                    "_id": "$analysis.validation.issues.type",
                    "count": {"$sum": 1},
                }
            },
        ])
    )

    analyzed = summary.get("analyzed", 0)
    passed = summary.get("passed", 0)

    return {
        "generated_at": utc_now(),
        "analyzed_complaints": analyzed,
        "validation_passed": passed,
        "validation_failed": summary.get("failed", 0),
        "pass_rate_percent": (
            round((passed / analyzed) * 100, 2)
            if analyzed
            else None
        ),
        "complaints_with_issues": summary.get("with_issues", 0),
        "ground_truth_valid": summary.get("ground_truth_valid", 0),
        "ground_truth_failed": summary.get(
            "ground_truth_failed",
            0,
        ),
        "manual_review_required": summary.get(
            "manual_review_required",
            0,
        ),
        "ai_output_blocked": summary.get("ai_output_blocked", 0),
        "issue_code_distribution": build_distribution(issue_code_rows),
        "issue_type_distribution": build_distribution(issue_type_rows),
        # No field-by-field GenAI/Python comparison is persisted
        # by the current analysis pipeline.
        "field_level_comparison_available": False,
    }
