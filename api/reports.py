"""
Report generation for SupportNova.

Every report is built from data the workflow already persists:

    complaints          status / department / assignment /
                        timestamps / priority / sla fields /
                        review_history
    analyses            classification / sentiment / escalation /
                        policies / resolution / validation
    complaint_activity  workflow timeline events
    audit_logs          actor actions

Reports are returned as a structured payload:

    {
      "report_type": ...,
      "title": ...,
      "generated_at": ...,
      "filters": {...},
      "summary": {...},          headline figures
      "columns": [...],          ordered column keys + labels
      "rows": [...],             one dict per row
      "unavailable": [...],      metrics the data cannot support
      "row_count": n
    }

The `unavailable` list is the honest counterpart of the SRS: when
the current schema cannot support a requested metric, the report
says so explicitly rather than inventing a number.
"""

import csv
import io
from datetime import datetime

from api.database import (
    complaints_collection,
    analyses_collection,
    complaint_activity_collection,
    users_collection,
)
from api.analytics import (
    CLOSED_STATUSES,
    OPEN_STATUSES,
    UNASSIGNED_LABEL,
    analysis_lookup_stages,
    as_utc,
    get_complaint_trends,
    get_department_performance,
    get_validation_statistics,
    query_datetime,
    utc_now,
)
from api.sla import get_sla_status


REPORT_TYPES = {
    "complaint-analysis": "Complaint Analysis",
    "department-performance": "Department Performance",
    "escalations": "Escalations",
    "sla-status": "SLA Status",
    "policy-usage": "Policy Usage",
    "resolution-compliance": "Resolution Compliance",
    "genai-python-comparison": "GenAI vs Python Comparison",
    "manual-reviews": "Manual Reviews",
}


class UnknownReportType(ValueError):
    """Raised when an unsupported report type is requested."""


# ============================================================
# HELPERS
# ============================================================

def parse_filter_date(value):
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


def build_match(*, date_from=None, date_to=None, department=None):
    match = {}

    if department:
        match["assigned_department"] = department

    created = {}

    parsed_from = parse_filter_date(date_from)
    parsed_to = parse_filter_date(date_to)

    if parsed_from:
        created["$gte"] = parsed_from

    if parsed_to:
        created["$lte"] = parsed_to

    if created:
        match["created_at"] = created

    return match


def _columns(*pairs):
    return [{"key": key, "label": label} for key, label in pairs]


def _hours_between(start, end):
    start = as_utc(start)
    end = as_utc(end)

    if not start or not end or end < start:
        return None

    return round((end - start).total_seconds() / 3600, 2)


def _envelope(
    report_type,
    *,
    summary,
    columns,
    rows,
    filters,
    unavailable=None,
):
    return {
        "report_type": report_type,
        "title": REPORT_TYPES[report_type],
        "generated_at": utc_now(),
        "filters": filters,
        "summary": summary,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "unavailable": unavailable or [],
    }


# ============================================================
# 1. COMPLAINT ANALYSIS
# ============================================================

def complaint_analysis_report(filters):
    match = build_match(**filters)

    pipeline = [
        *([{"$match": match}] if match else []),
        *analysis_lookup_stages(),
        {"$sort": {"created_at": -1}},
    ]

    rows = []

    category_counts = {}
    department_counts = {}
    sentiment_counts = {}

    for complaint in complaints_collection.aggregate(pipeline):
        analysis = complaint.get("analysis") or {}
        classification = analysis.get("classification") or {}
        sentiment = analysis.get("sentiment") or {}
        escalation = analysis.get("escalation") or {}

        category = classification.get("category") or "Not analyzed"
        department = (
            complaint.get("assigned_department") or UNASSIGNED_LABEL
        )
        sentiment_label = sentiment.get("label") or "Not recorded"

        category_counts[category] = (
            category_counts.get(category, 0) + 1
        )
        department_counts[department] = (
            department_counts.get(department, 0) + 1
        )
        sentiment_counts[sentiment_label] = (
            sentiment_counts.get(sentiment_label, 0) + 1
        )

        rows.append({
            "complaint_id": str(complaint["_id"]),
            "title": complaint.get("title"),
            "status": complaint.get("status"),
            "category": classification.get("category"),
            "subcategory": classification.get("subcategory"),
            "department": complaint.get("assigned_department"),
            "product": complaint.get("product"),
            "sentiment": sentiment.get("label"),
            "escalation_level": escalation.get("level"),
            "priority": complaint.get("priority"),
            "created_at": complaint.get("created_at"),
            "resolved_at": complaint.get("resolved_at"),
            "resolution_hours": _hours_between(
                complaint.get("created_at"),
                complaint.get("resolved_at"),
            ),
        })

    trends = get_complaint_trends(days=30)

    return _envelope(
        "complaint-analysis",
        filters=filters,
        summary={
            "total_complaints": len(rows),
            "category_distribution": dict(
                sorted(
                    category_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
            "department_distribution": dict(
                sorted(
                    department_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
            "sentiment_distribution": dict(
                sorted(
                    sentiment_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
            "created_last_30_days": trends["totals"]["created"],
            "resolved_last_30_days": trends["totals"]["resolved"],
        },
        columns=_columns(
            ("complaint_id", "Complaint ID"),
            ("title", "Title"),
            ("status", "Status"),
            ("category", "Category"),
            ("subcategory", "Subcategory"),
            ("department", "Department"),
            ("product", "Product"),
            ("sentiment", "Sentiment"),
            ("escalation_level", "Escalation level"),
            ("priority", "Priority"),
            ("created_at", "Created"),
            ("resolved_at", "Resolved"),
            ("resolution_hours", "Resolution hours"),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "channel",
                "reason": (
                    "Complaints are submitted through the web form "
                    "only; no channel field is stored."
                ),
            }
        ],
    )


# ============================================================
# 2. DEPARTMENT PERFORMANCE
# ============================================================

def department_performance_report(filters):
    performance = get_department_performance()

    rows = [
        {
            "department": row["department"],
            "total": row["total"],
            "open": row["open"],
            "in_progress": row["in_progress"],
            "awaiting_customer": row["awaiting_customer"],
            "escalated": row["escalated"],
            "manual_review": row["manual_review"],
            "resolved": row["resolved"],
            "closed": row["closed"],
            "resolution_rate_percent": row["resolution_rate_percent"],
            "average_resolution_hours": row[
                "average_resolution_hours"
            ],
        }
        for row in performance["departments"]
    ]

    agent_rows = list(
        users_collection.aggregate([
            {"$match": {"role": "Agent"}},
            {
                "$group": {
                    "_id": {
                        "$ifNull": ["$department", UNASSIGNED_LABEL]
                    },
                    "agents": {"$sum": 1},
                }
            },
        ])
    )

    agents_by_department = {
        row["_id"]: row["agents"] for row in agent_rows
    }

    for row in rows:
        row["agents"] = agents_by_department.get(
            row["department"],
            0,
        )

    return _envelope(
        "department-performance",
        filters=filters,
        summary={
            "departments": performance["department_count"],
            **performance["totals"],
        },
        columns=_columns(
            ("department", "Department"),
            ("agents", "Agents"),
            ("total", "Complaints"),
            ("open", "Open"),
            ("in_progress", "In progress"),
            ("awaiting_customer", "Awaiting customer"),
            ("escalated", "Escalated"),
            ("manual_review", "Manual review"),
            ("resolved", "Resolved"),
            ("closed", "Closed"),
            ("resolution_rate_percent", "Resolution rate %"),
            ("average_resolution_hours", "Avg resolution hours"),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "first_response_time",
                "reason": (
                    "No first-response timestamp is stored by the "
                    "workflow."
                ),
            }
        ],
    )


# ============================================================
# 3. ESCALATIONS
# ============================================================

def escalations_report(filters):
    match = build_match(**filters)

    events = list(
        complaint_activity_collection.find({
            "type": "escalated"
        }).sort("timestamp", 1)
    )

    first_event = {}

    for event in events:
        first_event.setdefault(event["complaint_id"], event)

    escalated_ids = set(first_event)

    pipeline = [
        *([{"$match": match}] if match else []),
        *analysis_lookup_stages(),
        {"$sort": {"updated_at": -1}},
    ]

    rows = []
    level_counts = {}
    reason_counts = {}
    resolved_after = 0

    for complaint in complaints_collection.aggregate(pipeline):
        complaint_id = str(complaint["_id"])

        analysis = complaint.get("analysis") or {}
        escalation = analysis.get("escalation") or {}

        is_escalated = (
            complaint.get("status") == "Escalated"
            or complaint_id in escalated_ids
            or escalation.get("required") is True
        )

        if not is_escalated:
            continue

        event = first_event.get(complaint_id)
        escalated_at = event.get("timestamp") if event else None

        level = escalation.get("level") or "Not recorded"
        level_counts[level] = level_counts.get(level, 0) + 1

        reason = escalation.get("reason")

        if reason:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

        if complaint.get("resolved_at"):
            resolved_after += 1

        rows.append({
            "complaint_id": complaint_id,
            "title": complaint.get("title"),
            "status": complaint.get("status"),
            "escalation_level": escalation.get("level"),
            "escalation_reason": escalation.get("reason"),
            "escalation_required": escalation.get("required"),
            "department": complaint.get("assigned_department"),
            "escalated_at": escalated_at,
            "escalated_by": event.get("actor") if event else None,
            "resolved_at": complaint.get("resolved_at"),
            "hours_to_resolution_after_escalation": (
                _hours_between(
                    escalated_at,
                    complaint.get("resolved_at"),
                )
            ),
        })

    return _envelope(
        "escalations",
        filters=filters,
        summary={
            "escalated_complaints": len(rows),
            "currently_escalated": sum(
                1
                for row in rows
                if row["status"] == "Escalated"
            ),
            "resolved_after_escalation": resolved_after,
            "level_distribution": dict(
                sorted(
                    level_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
            "reason_distribution": dict(
                sorted(
                    reason_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
            "without_escalation_event": sum(
                1 for row in rows if row["escalated_at"] is None
            ),
        },
        columns=_columns(
            ("complaint_id", "Complaint ID"),
            ("title", "Title"),
            ("status", "Status"),
            ("escalation_level", "Level"),
            ("escalation_reason", "Reason"),
            ("department", "Department"),
            ("escalated_at", "Escalated at"),
            ("escalated_by", "Escalated by"),
            ("resolved_at", "Resolved at"),
            (
                "hours_to_resolution_after_escalation",
                "Hours to resolution after escalation",
            ),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "de_escalation",
                "reason": (
                    "The workflow records escalation events but no "
                    "de-escalation event."
                ),
            }
        ],
    )


# ============================================================
# 4. SLA STATUS
# ============================================================

def sla_status_report(filters):
    status = get_sla_status(limit=200)

    rows = [
        {
            "complaint_id": row["id"],
            "title": row["title"],
            "status": row["status"],
            "priority": row["priority"],
            "department": row["assigned_department"],
            "sla_hours": row["sla_hours"],
            "sla_due_at": row["sla_due_at"],
            "sla_state": row["sla_state"],
            "hours_remaining": row["hours_remaining"],
        }
        for row in status["attention"]
    ]

    unavailable = []

    if status["without_sla_target"]:
        unavailable.append({
            "metric": "sla_target",
            "reason": (
                f"{status['without_sla_target']} complaint(s) were "
                "created before SLA targets were persisted, so "
                "their SLA state cannot be determined."
            ),
        })

    unavailable.append({
        "metric": "response_sla",
        "reason": (
            "Only a resolution SLA is produced by the rule engine; "
            "no separate first-response target exists."
        ),
    })

    return _envelope(
        "sla-status",
        filters=filters,
        summary={
            "total_complaints": status["total_complaints"],
            "with_sla_target": status["with_sla_target"],
            "without_sla_target": status["without_sla_target"],
            "coverage_percent": status["coverage_percent"],
            "met": status["met"],
            "breached": status["breached"],
            "at_risk": status["at_risk"],
            "on_track": status["on_track"],
            "compliance_percent": status["compliance_percent"],
            "at_risk_threshold_ratio": status[
                "at_risk_threshold_ratio"
            ],
            "departments": status["departments"],
        },
        columns=_columns(
            ("complaint_id", "Complaint ID"),
            ("title", "Title"),
            ("status", "Status"),
            ("priority", "Priority"),
            ("department", "Department"),
            ("sla_hours", "SLA hours"),
            ("sla_due_at", "Due at"),
            ("sla_state", "SLA state"),
            ("hours_remaining", "Hours remaining"),
        ),
        rows=rows,
        unavailable=unavailable,
    )


# ============================================================
# 5. POLICY USAGE
# ============================================================

def policy_usage_report(filters):
    """
    Which knowledge-base policies the analysis applied.

    Source: `analyses.analysis.policies[]`, which stores the full
    policy row returned by the rule engine.
    """

    rows_by_policy = {}
    analyses_with_policies = 0
    total_analyses = 0

    for document in analyses_collection.find({}):
        total_analyses += 1

        analysis = document.get("analysis") or {}
        policies = analysis.get("policies") or []

        if policies:
            analyses_with_policies += 1

        department = (
            (analysis.get("classification") or {}).get("department")
        )

        for policy in policies:
            if not isinstance(policy, dict):
                continue

            policy_id = (
                policy.get("Policy_ID")
                or policy.get("policy_id")
                or "Unknown"
            )

            entry = rows_by_policy.setdefault(
                policy_id,
                {
                    "policy_id": policy_id,
                    "policy_name": (
                        policy.get("Policy_Name")
                        or policy.get("policy_name")
                    ),
                    "owner_department": (
                        policy.get("Owner_Department")
                        or policy.get("owner_department")
                    ),
                    "policy_status": policy.get("Status"),
                    "times_applied": 0,
                    "departments": set(),
                },
            )

            entry["times_applied"] += 1

            if department:
                entry["departments"].add(department)

    rows = []

    for entry in rows_by_policy.values():
        rows.append({
            **entry,
            "departments": ", ".join(sorted(entry["departments"])),
        })

    rows.sort(
        key=lambda row: (-row["times_applied"], row["policy_id"])
    )

    return _envelope(
        "policy-usage",
        filters=filters,
        summary={
            "distinct_policies_applied": len(rows),
            "analyses_total": total_analyses,
            "analyses_with_policies": analyses_with_policies,
            "analyses_without_policies": max(
                total_analyses - analyses_with_policies,
                0,
            ),
            "total_applications": sum(
                row["times_applied"] for row in rows
            ),
        },
        columns=_columns(
            ("policy_id", "Policy ID"),
            ("policy_name", "Policy"),
            ("owner_department", "Owner department"),
            ("policy_status", "Policy status"),
            ("times_applied", "Times applied"),
            ("departments", "Applied in departments"),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "policy_effectiveness",
                "reason": (
                    "No outcome is recorded against an individual "
                    "policy, so effectiveness cannot be measured."
                ),
            }
        ],
    )


# ============================================================
# 6. RESOLUTION COMPLIANCE
# ============================================================

def resolution_compliance_report(filters):
    """
    Whether finished complaints carry the artefacts the workflow
    requires: a stored resolution, a resolution comment, an
    agent-recorded resolution timestamp and a passing validation.
    """

    match = build_match(**filters)

    pipeline = [
        {
            "$match": {
                **match,
                "status": {"$in": CLOSED_STATUSES},
            }
        },
        *analysis_lookup_stages(),
        {"$sort": {"resolved_at": -1}},
    ]

    rows = []

    with_steps = 0
    with_comment = 0
    with_timestamp = 0
    validation_passed = 0

    for complaint in complaints_collection.aggregate(pipeline):
        analysis = complaint.get("analysis") or {}
        resolution = analysis.get("resolution") or {}
        validation = analysis.get("validation") or {}

        steps = resolution.get("steps") or []
        comment = complaint.get("resolution_comment")
        resolved_at = complaint.get("resolved_at")
        validation_status = validation.get("status")

        if steps:
            with_steps += 1

        if comment:
            with_comment += 1

        if resolved_at:
            with_timestamp += 1

        if validation_status == "Passed":
            validation_passed += 1

        rows.append({
            "complaint_id": str(complaint["_id"]),
            "title": complaint.get("title"),
            "status": complaint.get("status"),
            "department": complaint.get("assigned_department"),
            "resolution_steps": len(steps),
            "has_resolution_comment": bool(comment),
            "resolved_at": resolved_at,
            "closed_at": complaint.get("closed_at"),
            "resolution_hours": _hours_between(
                complaint.get("created_at"),
                resolved_at,
            ),
            "validation_status": validation_status,
            "manual_review_required": complaint.get(
                "manual_review_required",
                False,
            ),
        })

    total = len(rows)

    return _envelope(
        "resolution-compliance",
        filters=filters,
        summary={
            "finished_complaints": total,
            "with_resolution_steps": with_steps,
            "with_resolution_comment": with_comment,
            "with_resolution_timestamp": with_timestamp,
            "missing_resolution_timestamp": max(
                total - with_timestamp,
                0,
            ),
            "validation_passed": validation_passed,
            "compliance_percent": (
                round((with_comment / total) * 100, 2)
                if total
                else None
            ),
        },
        columns=_columns(
            ("complaint_id", "Complaint ID"),
            ("title", "Title"),
            ("status", "Status"),
            ("department", "Department"),
            ("resolution_steps", "Resolution steps"),
            ("has_resolution_comment", "Resolution comment"),
            ("resolved_at", "Resolved at"),
            ("closed_at", "Closed at"),
            ("resolution_hours", "Resolution hours"),
            ("validation_status", "Validation"),
            ("manual_review_required", "Manual review"),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "prohibited_actions",
                "reason": (
                    "The rule engine's prohibited-action list is not "
                    "persisted with the analysis, so compliance "
                    "against it cannot be evaluated."
                ),
            }
        ],
    )


# ============================================================
# 7. GENAI vs PYTHON COMPARISON
# ============================================================

def genai_python_comparison_report(filters):
    """
    What the system really records about GenAI output versus the
    independent Python validation.

    The pipeline stores the Python validation verdict and the
    guard decision, but it does NOT store the GenAI and Python
    values side by side, so no field-level agreement rate can be
    reported.
    """

    validation = get_validation_statistics()

    rows = []

    for document in analyses_collection.find({}).sort("created_at", -1):
        analysis = document.get("analysis") or {}
        validation_block = analysis.get("validation") or {}
        guard = analysis.get("ai_guard") or {}
        classification = analysis.get("classification") or {}

        issues = validation_block.get("issues") or []

        rows.append({
            "complaint_id": document.get("complaint_id"),
            "category": classification.get("category"),
            "department": classification.get("department"),
            "validation_status": validation_block.get("status"),
            "ground_truth_valid": validation_block.get(
                "ground_truth_valid"
            ),
            "manual_review_required": validation_block.get(
                "manual_review_required"
            ),
            "issue_count": len(issues),
            "issue_codes": ", ".join(
                str(issue.get("code"))
                for issue in issues
                if isinstance(issue, dict) and issue.get("code")
            ),
            "ai_output_blocked": bool(guard.get("blocked")),
            "ai_guard_reason": guard.get("reason"),
        })

    return _envelope(
        "genai-python-comparison",
        filters=filters,
        summary={
            "analyses": validation["analyzed_complaints"],
            "validation_passed": validation["validation_passed"],
            "validation_failed": validation["validation_failed"],
            "pass_rate_percent": validation["pass_rate_percent"],
            "ground_truth_valid": validation["ground_truth_valid"],
            "ground_truth_failed": validation["ground_truth_failed"],
            "manual_review_required": validation[
                "manual_review_required"
            ],
            "ai_output_blocked": validation["ai_output_blocked"],
            "issue_code_distribution": validation[
                "issue_code_distribution"
            ],
        },
        columns=_columns(
            ("complaint_id", "Complaint ID"),
            ("category", "Category"),
            ("department", "Department"),
            ("validation_status", "Python validation"),
            ("ground_truth_valid", "Ground truth valid"),
            ("manual_review_required", "Manual review"),
            ("issue_count", "Issues"),
            ("issue_codes", "Issue codes"),
            ("ai_output_blocked", "AI output blocked"),
            ("ai_guard_reason", "Guard reason"),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "field_level_agreement",
                "reason": (
                    "The analysis pipeline stores one merged result; "
                    "the GenAI value and the Python value for each "
                    "field are not persisted separately, so a "
                    "field-by-field match rate cannot be computed."
                ),
            }
        ],
    )


# ============================================================
# 8. MANUAL REVIEWS
# ============================================================

def manual_reviews_report(filters):
    match = build_match(**filters)

    query = {
        **match,
        "$or": [
            {"manual_review_required": True},
            {"review_status": {"$ne": None}},
            {"review_history": {"$exists": True, "$ne": []}},
        ],
    }

    rows = []

    outcome_counts = {}
    reviewer_counts = {}
    pending = 0
    completed = 0

    for complaint in complaints_collection.find(query).sort(
        "updated_at",
        -1,
    ):
        history = complaint.get("review_history") or []
        last = history[-1] if history else {}

        review_status = complaint.get("review_status")

        if review_status == "Completed":
            completed += 1
        elif complaint.get("manual_review_required"):
            pending += 1

        for entry in history:
            action = entry.get("action")

            if action:
                outcome_counts[action] = (
                    outcome_counts.get(action, 0) + 1
                )

            reviewer = (
                entry.get("reviewer_name")
                or entry.get("reviewer_id")
            )

            if reviewer:
                reviewer_counts[reviewer] = (
                    reviewer_counts.get(reviewer, 0) + 1
                )

        rows.append({
            "complaint_id": str(complaint["_id"]),
            "title": complaint.get("title"),
            "status": complaint.get("status"),
            "department": complaint.get("assigned_department"),
            "review_status": review_status,
            "manual_review_required": complaint.get(
                "manual_review_required",
                False,
            ),
            "review_actions": len(history),
            "last_action": last.get("action"),
            "last_reviewer": last.get("reviewer_name"),
            "last_action_at": last.get("created_at"),
            "last_comment": last.get("comment"),
        })

    return _envelope(
        "manual-reviews",
        filters=filters,
        summary={
            "complaints_in_scope": len(rows),
            "pending_reviews": pending,
            "completed_reviews": completed,
            "total_review_actions": sum(outcome_counts.values()),
            "outcome_distribution": dict(
                sorted(
                    outcome_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
            "reviewer_distribution": dict(
                sorted(
                    reviewer_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
        },
        columns=_columns(
            ("complaint_id", "Complaint ID"),
            ("title", "Title"),
            ("status", "Status"),
            ("department", "Department"),
            ("review_status", "Review status"),
            ("manual_review_required", "Review required"),
            ("review_actions", "Review actions"),
            ("last_action", "Last action"),
            ("last_reviewer", "Last reviewer"),
            ("last_action_at", "Last action at"),
            ("last_comment", "Last comment"),
        ),
        rows=rows,
        unavailable=[
            {
                "metric": "review_duration",
                "reason": (
                    "Only the completion time of each review action "
                    "is stored; no reviewer start time exists."
                ),
            }
        ],
    )


# ============================================================
# CSV EXPORT
# ============================================================

def _csv_value(value):
    if value is None:
        return ""

    if isinstance(value, bool):
        return "Yes" if value else "No"

    if isinstance(value, datetime):
        return as_utc(value).isoformat()

    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(item) for item in value)

    if isinstance(value, dict):
        return "; ".join(
            f"{key}: {inner}" for key, inner in value.items()
        )

    return str(value)


def render_report_csv(report: dict) -> str:
    """
    Render a generated report as CSV.

    The file contains the report header, the summary figures, any
    explicitly unavailable metric, and then the data rows, so an
    exported file can never imply a metric the system does not
    actually have.
    """

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")

    writer.writerow(["SupportNova report", report["title"]])
    writer.writerow(
        ["Generated at", _csv_value(report["generated_at"])]
    )

    for key, value in (report.get("filters") or {}).items():
        if value:
            writer.writerow([f"Filter: {key}", _csv_value(value)])

    writer.writerow(["Rows", report.get("row_count", 0)])
    writer.writerow([])

    summary = report.get("summary") or {}

    if summary:
        writer.writerow(["Summary"])

        for key, value in summary.items():
            if isinstance(value, dict):
                for inner_key, inner_value in value.items():
                    writer.writerow([
                        f"{key}.{inner_key}",
                        _csv_value(inner_value),
                    ])
            elif isinstance(value, list):
                for index, item in enumerate(value):
                    writer.writerow([
                        f"{key}[{index}]",
                        _csv_value(item),
                    ])
            else:
                writer.writerow([key, _csv_value(value)])

        writer.writerow([])

    unavailable = report.get("unavailable") or []

    if unavailable:
        writer.writerow(["Unavailable metrics"])

        for item in unavailable:
            writer.writerow([
                item.get("metric"),
                item.get("reason"),
            ])

        writer.writerow([])

    columns = report.get("columns") or []

    if columns:
        writer.writerow([column["label"] for column in columns])

        for row in report.get("rows") or []:
            writer.writerow([
                _csv_value(row.get(column["key"]))
                for column in columns
            ])

    return buffer.getvalue()


# ============================================================
# DISPATCH
# ============================================================

REPORT_BUILDERS = {
    "complaint-analysis": complaint_analysis_report,
    "department-performance": department_performance_report,
    "escalations": escalations_report,
    "sla-status": sla_status_report,
    "policy-usage": policy_usage_report,
    "resolution-compliance": resolution_compliance_report,
    "genai-python-comparison": genai_python_comparison_report,
    "manual-reviews": manual_reviews_report,
}


def list_reports():
    """Report catalogue for the reports page."""

    return {
        "generated_at": utc_now(),
        "reports": [
            {
                "report_type": report_type,
                "title": title,
                "export_formats": ["csv"],
            }
            for report_type, title in REPORT_TYPES.items()
        ],
        "export_formats_unavailable": [
            {
                "format": "pdf",
                "reason": (
                    "No PDF generation library is installed in the "
                    "backend requirements."
                ),
            },
            {
                "format": "xlsx",
                "reason": (
                    "No spreadsheet library is installed in the "
                    "backend requirements."
                ),
            },
        ],
    }


def generate_report(
    report_type: str,
    *,
    date_from=None,
    date_to=None,
    department=None,
):
    if report_type not in REPORT_BUILDERS:
        raise UnknownReportType(report_type)

    filters = {
        "date_from": date_from,
        "date_to": date_to,
        "department": department,
    }

    return REPORT_BUILDERS[report_type](filters)


# Statuses are re-exported for callers that group report rows.
__all__ = [
    "CLOSED_STATUSES",
    "OPEN_STATUSES",
    "REPORT_TYPES",
    "UnknownReportType",
    "generate_report",
    "list_reports",
    "render_report_csv",
]
