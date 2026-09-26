"""
Shared in-memory database fixtures for the analytics, statistics
and reporting tests.

The tests run the REAL aggregation pipelines against `mongomock`,
so the pipelines themselves are executed rather than mocked. No
live MongoDB instance is required.

Documents created here mirror exactly what the existing workflow
writes:

    api/main.py                complaint + analysis creation
    api/workflow.py            workflow fields
    api/assignment.py          assignment
    api/agent.py               agent transitions (resolve closes)
    api/review.py              review_history entries
    api/audit.py               audit logs
    api/activity.py            complaint activity timeline
"""

import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-only")

import mongomock
from bson import ObjectId


NOW = datetime.now(timezone.utc).replace(microsecond=0)


def hours_ago(hours: float) -> datetime:
    return NOW - timedelta(hours=hours)


def days_ago(days: float) -> datetime:
    return NOW - timedelta(days=days)


# ============================================================
# DOCUMENT BUILDERS
# ============================================================

def make_complaint(
    *,
    status="Analyzed",
    department="Billing",
    assigned_to=None,
    created_at=None,
    resolved_at=None,
    closed_at=None,
    manual_review_required=False,
    review_status=None,
    reviewer_id=None,
    review_history=None,
    priority=None,
    sla_hours=None,
    sla_due_at=None,
    title="Complaint",
    description="Description",
    user_id="customer-1",
    resolution_comment=None,
):
    document = {
        "_id": ObjectId(),
        "title": title,
        "description": description,
        "user_id": user_id,
        "customer_id": user_id,
        "status": status,
        "assigned_department": department,
        "assigned_to": assigned_to,
        "manual_review_required": manual_review_required,
        "review_status": review_status,
        "reviewer_id": reviewer_id,
        "created_at": created_at or days_ago(2),
        "updated_at": created_at or days_ago(2),
        "resolved_at": resolved_at,
        "closed_at": closed_at,
    }

    if review_history is not None:
        document["review_history"] = review_history

    if priority is not None:
        document["priority"] = priority

    if sla_hours is not None:
        document["sla_hours"] = sla_hours

    if sla_due_at is not None:
        document["sla_due_at"] = sla_due_at

    if resolution_comment is not None:
        document["resolution_comment"] = resolution_comment

    return document


def make_analysis(
    complaint_id,
    *,
    category="Billing & Payments",
    subcategory="Duplicate charge",
    department="Billing",
    sentiment="negative",
    escalation_required=False,
    escalation_level="Standard",
    escalation_reason="",
    policies=None,
    validation_status="Passed",
    ground_truth_valid=True,
    manual_review_required=False,
    issues=None,
    resolution_steps=None,
    priority=None,
    sla_hours=None,
    ai_blocked=False,
):
    analysis = {
        "complaint": {
            "id": str(complaint_id),
            "title": "Complaint",
            "description": "Description",
        },
        "classification": {
            "category": category,
            "subcategory": subcategory,
            "department": department,
        },
        "sentiment": {
            "label": sentiment,
            "emotion": "",
        },
        "entities": {},
        "policies": policies if policies is not None else [
            {
                "Policy_ID": "POL07",
                "Policy_Name": "Refund Policy",
                "Policy_Rule": "Refund within 14 days",
                "Owner_Department": "Billing",
                "Status": "Active",
            }
        ],
        "resolution": {
            "steps": (
                resolution_steps
                if resolution_steps is not None
                else ["Verify the transaction", "Issue refund"]
            ),
            "explanation": "",
        },
        "escalation": {
            "required": escalation_required,
            "level": escalation_level,
            "reason": escalation_reason,
            "rules": [],
        },
        "routing": {
            "primary_department": department,
            "supporting_departments": [],
        },
        "prompt": {"name": "complaint_analysis", "version": "v1"},
        "customer_response": "",
        "follow_up": {"required": False, "message": ""},
        "agent_guidance": "",
        "clarification_questions": [],
        "validation": {
            "status": validation_status,
            "manual_review_required": manual_review_required,
            "issues": issues or [],
            "ground_truth_valid": ground_truth_valid,
            "ground_truth_result": {"valid": ground_truth_valid},
        },
        "manual_review_required": manual_review_required,
    }

    if priority is not None:
        analysis["priority"] = priority

    if sla_hours is not None:
        analysis["sla_hours"] = sla_hours

    if ai_blocked:
        analysis["ai_guard"] = {"blocked": True, "reason": "test"}

    return {
        "complaint_id": str(complaint_id),
        "analysis": analysis,
        "created_at": NOW,
    }


def make_activity(
    complaint_id,
    *,
    activity_type="status",
    title="Event",
    timestamp=None,
    metadata=None,
    actor="SupportNova",
    actor_role="System",
    customer_visible=False,
):
    return {
        "complaint_id": str(complaint_id),
        "type": activity_type,
        "title": title,
        "description": "",
        "actor": actor,
        "actor_role": actor_role,
        "metadata": metadata or {},
        "customer_visible": customer_visible,
        "timestamp": timestamp or NOW,
    }


def make_audit_log(
    *,
    actor_id="user-1",
    actor_role="Agent",
    action="Agent: Started handling",
    entity_type="complaint",
    entity_id="complaint-1",
    details=None,
    created_at=None,
):
    return {
        "_id": ObjectId(),
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": created_at or NOW,
    }


def make_user(
    *,
    name="Test User",
    email="user@example.com",
    role="Agent",
    status="Active",
    department="Billing",
    created_at=None,
):
    return {
        "_id": ObjectId(),
        "name": name,
        "email": email,
        "password": "hashed",
        "role": role,
        "status": status,
        "department": department,
        "created_at": created_at or days_ago(30),
    }


# ============================================================
# IN-MEMORY DATABASE WIRING
# ============================================================

MODULES_USING_COMPLAINTS = (
    "api.analytics",
    "api.management",
    "api.review",
    "api.agent",
    "api.reports",
    "api.sla",
    "api.audit",
    "api.activity",
    "api.assignment",
    "api.auth",
    # Only patched when the test already imported the FastAPI
    # application; importing it here would require the trained
    # ML model files.
    "api.main",
)


def install_memory_database(monkeypatch, *, documents=None):
    """
    Point every analytics/reporting module at a fresh mongomock
    database and return the collections.
    """

    client = mongomock.MongoClient()
    database = client["supportnova_test"]

    collections = {
        "complaints": database["complaints"],
        "analyses": database["analyses"],
        "users": database["users"],
        "audit_logs": database["audit_logs"],
        "complaint_activity": database["complaint_activity"],
        "knowledge_documents": database["knowledge_documents"],
    }

    documents = documents or {}

    for name, docs in documents.items():
        if docs:
            collections[name].insert_many(docs)

    import importlib

    attribute_by_collection = {
        "complaints": "complaints_collection",
        "analyses": "analyses_collection",
        "users": "users_collection",
        "audit_logs": "audit_logs_collection",
        "complaint_activity": "complaint_activity_collection",
        "knowledge_documents": "knowledge_documents_collection",
    }

    import api.database as database_module

    for name, attribute in attribute_by_collection.items():
        monkeypatch.setattr(
            database_module,
            attribute,
            collections[name],
            raising=False,
        )

    import sys

    for module_name in MODULES_USING_COMPLAINTS:
        module = sys.modules.get(module_name)

        if module is None:
            try:
                module = importlib.import_module(module_name)
            except Exception:
                # Modules that cannot be imported in a bare test
                # environment (api.main needs the ML model files)
                # are simply skipped unless a test loaded them.
                continue

        for name, attribute in attribute_by_collection.items():
            if hasattr(module, attribute):
                monkeypatch.setattr(
                    module,
                    attribute,
                    collections[name],
                )

    return collections
