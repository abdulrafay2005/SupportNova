from datetime import datetime, timezone


COMPLAINT_STATUSES = {
    "New",
    "Analyzed",
    "Assigned",
    "In Progress",
    "Awaiting Customer",
    "Escalated",
    "Resolved",
    "Closed",
    "Reopened",
    "Manual Review",
}


def utc_now():
    return datetime.now(timezone.utc)


def determine_initial_status(analysis: dict) -> str:
    """
    Determine the workflow state immediately after analysis.

    This does not perform ML classification.
    It only interprets the existing analysis output.
    """

    manual_review = analysis.get(
        "manual_review_required",
        False
    )

    if manual_review:
        return "Manual Review"

    escalation = analysis.get(
        "escalation",
        {}
    )

    if escalation.get("required"):
        return "Escalated"

    return "Analyzed"


def build_workflow_fields(
    *,
    analysis: dict,
    customer_id: str
) -> dict:

    now = utc_now()

    status = determine_initial_status(
        analysis
    )

    classification = analysis.get(
        "classification",
        {}
    )

    routing = analysis.get(
        "routing",
        {}
    )

    return {
        "status": status,

        "customer_id": customer_id,

        "assigned_to": None,

        "assigned_department": (
            routing.get("primary_department")
            or classification.get("department")
        ),

        "manual_review_required": (
            status == "Manual Review"
        ),

        "review_status": (
            "Pending"
            if status == "Manual Review"
            else None
        ),

        "reviewer_id": None,

        "created_at": now,
        "updated_at": now,

        "resolved_at": None,
        "closed_at": None,
    }