import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in .env")

client = MongoClient(MONGO_URI)

db = client["supportnova"]

complaints_collection = db["complaints"]
analyses_collection = db["analyses"]
users_collection = db["users"]
audit_logs_collection = db["audit_logs"]
knowledge_documents_collection = db["knowledge_documents"]
complaint_activity_collection = db["complaint_activity"]
departments_collection = db["departments"]


# ============================================================
# INDEXES
#
# Dashboard, analytics and reporting queries filter and group on
# these fields. Index creation is idempotent and is executed on
# application startup (see api/main.py), never at import time,
# so importing the module never requires a live database.
# ============================================================

INDEX_DEFINITIONS = [
    (complaints_collection, [("status", 1)]),
    (complaints_collection, [("created_at", -1)]),
    (complaints_collection, [("assigned_department", 1)]),
    (complaints_collection, [("assigned_to", 1)]),
    (complaints_collection, [("manual_review_required", 1)]),
    (complaints_collection, [("review_status", 1)]),
    (complaints_collection, [("resolved_at", -1)]),
    (complaints_collection, [("sla_due_at", 1)]),
    (analyses_collection, [("complaint_id", 1)]),
    (audit_logs_collection, [("created_at", -1)]),
    (audit_logs_collection, [("actor_id", 1)]),
    (audit_logs_collection, [("entity_type", 1)]),
    (complaint_activity_collection, [("complaint_id", 1), ("timestamp", 1)]),
    (complaint_activity_collection, [("type", 1), ("timestamp", -1)]),
    (users_collection, [("role", 1), ("status", 1)]),
    (users_collection, [("department", 1)]),
    (departments_collection, [("name", 1)]),
]


# Staff provisioning relies on e-mail being unique. The unique index
# is defined separately because it must be created with unique=True.
UNIQUE_INDEX_DEFINITIONS = [
    (users_collection, [("email", 1)]),
]


def ensure_indexes():
    """
    Create the analytics/reporting indexes.

    Returns the list of created (or already present) index names.
    Failures are reported, never raised: an unreachable or
    read-only database must not prevent the API from starting.
    """

    created = []

    for collection, keys in INDEX_DEFINITIONS:
        try:
            created.append(collection.create_index(keys))
        except Exception as error:  # pragma: no cover - environment dependent
            print(
                f"Index creation skipped for "
                f"{collection.name} {keys}: {error}"
            )

    for collection, keys in UNIQUE_INDEX_DEFINITIONS:
        try:
            created.append(
                collection.create_index(keys, unique=True)
            )
        except Exception as error:  # pragma: no cover - env dependent
            print(
                f"Unique index creation skipped for "
                f"{collection.name} {keys}: {error}"
            )

    return created