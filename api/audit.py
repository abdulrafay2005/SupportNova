from datetime import datetime, timezone

from api.database import db


audit_logs_collection = db["audit_logs"]


def create_audit_log(
    *,
    actor_id: str,
    actor_role: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict | None = None,
    success: bool = True
):
    # `success` records whether the audited action succeeded or was
    # rejected (SRS #48). It defaults to True so existing callers,
    # which only log completed actions, are unchanged; failure paths
    # (e.g. blocked/failed logins) pass success=False.
    document = {
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "success": success,
        "details": details or {},
        "created_at": datetime.now(timezone.utc),
    }

    result = audit_logs_collection.insert_one(document)

    return str(result.inserted_id)