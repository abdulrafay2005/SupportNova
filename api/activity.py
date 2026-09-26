"""
Persistent complaint activity (timeline) records.

Every meaningful workflow event creates one document in the
`complaint_activity` collection. The Complaint Detail timeline
is reconstructed from these documents — never from React state
and never by inferring history from the current complaint
document.

`customer_visible` separates internal workflow events from the
customer-facing updates a complaint owner is allowed to see.
"""

from datetime import datetime, timezone

from api.database import complaint_activity_collection


def create_complaint_activity(
    *,
    complaint_id: str,
    activity_type: str,
    title: str,
    description: str = "",
    actor: str = "SupportNova",
    actor_role: str = "System",
    metadata: dict | None = None,
    customer_visible: bool = False,
):
    document = {
        "complaint_id": complaint_id,
        "type": activity_type,
        "title": title,
        "description": description or "",
        "actor": actor,
        "actor_role": actor_role,
        "metadata": metadata or {},
        "customer_visible": bool(customer_visible),
        "timestamp": datetime.now(timezone.utc),
    }

    complaint_activity_collection.insert_one(document)

    return document
