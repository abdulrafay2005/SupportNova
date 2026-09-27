"""
Route-level tests for the statistics, reporting and SLA work.

Two things are checked here that unit tests cannot cover:

1. every endpoint added or changed by this work is registered
   with the expected method and guarded by `require_roles` with
   the expected roles;
2. the additive SLA persistence in `create_complaint` really
   writes the rule engine's own `priority` / `sla_hours` values,
   and writes nothing when the rule engine produced no SLA
   window.

The ML layer itself is never exercised: the two entry points
`analyze_complaint` and `analyze_with_ai` are replaced with
deterministic stand-ins so the surrounding persistence code can
be tested without the trained model files.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from api.tests.analytics_fixtures import install_memory_database
from api.tests.app_harness import load_app, route_dependencies, route_map


# ============================================================
# ROLE AUTHORISATION
# ============================================================

# path -> (method, allowed roles)
GUARDED_ENDPOINTS = {
    "/api/management/trends": ("GET", {"Manager", "Admin"}),
    "/api/management/department-performance": (
        "GET",
        {"Manager", "Admin"},
    ),
    "/api/management/resolution-statistics": (
        "GET",
        {"Manager", "Admin"},
    ),
    "/api/management/analytics": ("GET", {"Manager", "Admin"}),
    "/api/management/sentiment": ("GET", {"Manager", "Admin"}),
    "/api/management/complaints": ("GET", {"Manager", "Admin"}),
    "/api/management/escalations": ("GET", {"Manager", "Admin"}),
    "/api/management/sla": ("GET", {"Manager", "Admin"}),
    "/api/management/reports": ("GET", {"Manager", "Admin"}),
    "/api/management/reports/{report_type}": (
        "GET",
        {"Manager", "Admin"},
    ),
    "/api/management/reports/{report_type}/export": (
        "GET",
        {"Manager", "Admin"},
    ),
    "/api/admin/statistics": ("GET", {"Admin"}),
    "/api/admin/audit": ("GET", {"Admin"}),
    "/api/admin/audit/summary": ("GET", {"Admin"}),
    "/api/review/statistics": ("GET", {"Reviewer", "Manager", "Admin"}),
    "/api/agent/statistics": ("GET", {"Agent"}),
}


@pytest.fixture(scope="module")
def app():
    return load_app()


def allowed_roles_for(app, path, method):
    """Read the roles closed over by the route's `require_roles`."""

    for route in app.routes:
        methods = getattr(route, "methods", None)

        if not methods or route.path != path:
            continue

        if method.upper() not in methods:
            continue

        for dependency in route.dependant.dependencies:
            call = dependency.call

            if getattr(call, "__name__", "") != "role_checker":
                continue

            closure = call.__closure__ or ()

            for cell in closure:
                value = cell.cell_contents

                if isinstance(value, tuple) and all(
                    isinstance(item, str) for item in value
                ):
                    return set(value)

    return None


@pytest.mark.parametrize(
    ("path", "method", "roles"),
    [
        (path, method, roles)
        for path, (method, roles) in GUARDED_ENDPOINTS.items()
    ],
)
def test_endpoint_is_registered_and_role_guarded(
    app,
    path,
    method,
    roles,
):
    routes = route_map(app)

    assert path in routes, f"{path} is not registered"
    assert method in routes[path]

    names = route_dependencies(app, path, method)
    assert names is not None
    assert any("role_checker" in name for name in names), (
        f"{method} {path} is not guarded by require_roles"
    )

    assert allowed_roles_for(app, path, method) == roles


def test_no_statistics_endpoint_is_public(app):
    for path, (method, _roles) in GUARDED_ENDPOINTS.items():
        names = route_dependencies(app, path, method) or []
        assert names, f"{method} {path} has no dependencies at all"


# ============================================================
# SLA PERSISTENCE ON COMPLAINT CREATION
# ============================================================

def rule_engine_result(*, priority="High", sla_hours=24):
    """
    Minimal stand-in for the rule engine result, using the same
    keys `ml/rule_engine.py` returns.
    """

    result = {
        "complaint": {
            "complaint_id": "test",
            "title": "Charged twice",
            "text": "I was charged twice for one order.",
        },
        "classification": {
            "category": "Billing & Payments",
            "subcategory": "Duplicate charge",
            "department": "Billing",
        },
        "routing": {
            "primary_department": "Billing",
            "supporting_departments": [],
        },
        "escalation": {
            "required": False,
            "highest_severity": priority,
            "rule_ids": [],
            "rules": [],
        },
        "policies": [],
        "resolution_rules": [],
    }

    if priority is not None:
        result["priority"] = priority

    if sla_hours is not None:
        result["sla_hours"] = sla_hours

    return result


def ai_result(rule_result):
    """
    Stand-in for `analyze_with_ai`. It mirrors the real layer's
    behaviour of dropping `priority` and `sla_hours`, which is
    exactly why the API has to persist them itself.
    """

    return {
        "complaint": rule_result["complaint"],
        "classification": rule_result["classification"],
        "routing": rule_result["routing"],
        "escalation": rule_result["escalation"],
        "policies": rule_result["policies"],
        "resolution": {"steps": []},
        "sentiment": {"label": "negative", "emotion": "frustration"},
        "entities": {},
        "customer_response": "",
        "follow_up": {},
        "agent_guidance": {},
        "clarification_questions": [],
        "ai_guard": {"blocked": False, "reason": ""},
    }


@pytest.fixture
def client(app, monkeypatch):
    import api.main as main

    collections = install_memory_database(monkeypatch)

    collections["users"].insert_one({
        "name": "Test Customer",
        "email": "customer@example.com",
        "role": "Customer",
        "status": "Active",
    })

    def fake_current_user():
        return {
            "id": "customer-1",
            "name": "Test Customer",
            "email": "customer@example.com",
            "role": "Customer",
        }

    app.dependency_overrides[main.get_current_user] = fake_current_user

    yield TestClient(app), collections, main

    app.dependency_overrides.clear()


def submit(client_tuple, *, priority="High", sla_hours=24):
    test_client, collections, main = client_tuple

    rule_result = rule_engine_result(
        priority=priority,
        sla_hours=sla_hours,
    )

    main.analyze_complaint = lambda _payload: rule_result
    main.analyze_with_ai = lambda result: ai_result(result)

    response = test_client.post(
        "/api/complaints",
        json={
            "title": "Charged twice",
            "description": "I was charged twice for one order.",
        },
    )

    return response, collections


def test_create_complaint_persists_rule_engine_sla(client):
    response, collections = submit(client, priority="High", sla_hours=24)

    assert response.status_code == 200, response.text

    stored = collections["complaints"].find_one({})
    assert stored is not None

    assert stored["priority"] == "High"
    assert stored["sla_hours"] == 24.0

    created_at = stored["created_at"]
    due_at = stored["sla_due_at"]

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)

    assert due_at - created_at == timedelta(hours=24)


def test_created_complaint_is_visible_to_the_sla_module(client):
    submit(client, priority="Critical", sla_hours=4)

    import api.sla as sla

    status = sla.get_sla_status()

    assert status["total_complaints"] == 1
    assert status["with_sla_target"] == 1
    assert status["without_sla_target"] == 0
    assert status["state_distribution"].get("On track") == 1


def test_create_complaint_without_sla_hours_writes_no_target(client):
    response, collections = submit(client, priority="Standard", sla_hours=None)

    assert response.status_code == 200, response.text

    stored = collections["complaints"].find_one({})

    assert stored["priority"] == "Standard"
    assert "sla_hours" not in stored
    assert "sla_due_at" not in stored

    import api.sla as sla

    status = sla.get_sla_status()
    assert status["with_sla_target"] == 0
    assert status["without_sla_target"] == 1
    assert status["unavailable"] == 1


def test_create_complaint_still_stores_the_analysis(client):
    response, collections = submit(client)

    assert response.status_code == 200

    analysis_document = collections["analyses"].find_one({})
    assert analysis_document is not None

    analysis = analysis_document["analysis"]

    # The workflow output is unchanged...
    assert analysis["classification"]["category"] == "Billing & Payments"
    assert "validation" in analysis

    # ...and the rule engine values now travel with it.
    assert analysis["priority"] == "High"
    assert analysis["sla_hours"] == 24

    stored = collections["complaints"].find_one({})
    assert stored["status"] in {
        "Analyzed",
        "Assigned",
        "Manual Review",
        "Escalated",
    }
    assert isinstance(stored["created_at"], datetime)
