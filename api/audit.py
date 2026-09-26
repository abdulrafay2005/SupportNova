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
    details: dict | None = None
):
    document = {
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": datetime.now(timezone.utc),
    }

    result = audit_logs_collection.insert_one(document)

    return str(result.inserted_id)