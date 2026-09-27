"""
Administrator staff provisioning, department registry and the
department -> agent routing contract.

Everything here runs against mongomock through the existing
`install_memory_database` fixture, so the real persistence code is
exercised: no behaviour is asserted from a stub.
"""

import os
from datetime import datetime, timezone

os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-only")

import pytest
from bson import ObjectId
from fastapi import HTTPException

import api.assignment as assignment_module
import api.departments as departments_module
import api.review as review_module
import api.staff as staff_module
from api.auth import verify_password
from api.tests.analytics_fixtures import install_memory_database
from api.tests.app_harness import load_app, route_dependencies, route_map


ADMIN = {"id": "admin-1", "name": "Admin One", "role": "Admin"}


@pytest.fixture
def db(monkeypatch):
    collections = install_memory_database(monkeypatch)

    collections["departments"].insert_many([
        {
            "name": "Payments & Finance",
            "code": "DEP03",
            "description": "Charges, invoices, refunds",
            "status": "Active",
            "source": "system",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "name": "Logistics",
            "code": "DEP04",
            "description": "Courier coordination",
            "status": "Active",
            "source": "system",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "name": "Retired Desk",
            "code": None,
            "description": "",
            "status": "Inactive",
            "source": "custom",
            "created_at": datetime.now(timezone.utc),
        },
    ])

    return collections


# ============================================================
# 1. ADMIN CREATES STAFF
# ============================================================

def test_admin_creates_agent_with_department(db):
    created = staff_module.create_staff_user(
        name="Agent A",
        email="Agent.A@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )

    assert created["role"] == "Agent"
    assert created["department"] == "Payments & Finance"
    assert created["status"] == "Active"

    stored = db["users"].find_one({"email": "agent.a@example.com"})

    assert stored is not None
    assert stored["role"] == "Agent"
    assert stored["department"] == "Payments & Finance"

    # Password is hashed, never stored or returned in clear text.
    assert stored["password"] != "Str0ngPass!"
    assert verify_password("Str0ngPass!", stored["password"])
    assert "password" not in created

    audit = db["audit_logs"].find_one({
        "action": "Staff account created",
    })
    assert audit is not None
    assert audit["entity_id"] == created["id"]
    assert "password" not in audit["details"]


def test_admin_creates_reviewer_without_department(db):
    created = staff_module.create_staff_user(
        name="Reviewer One",
        email="reviewer@example.com",
        password="Str0ngPass!",
        role="Reviewer",
        actor=ADMIN,
    )

    assert created["role"] == "Reviewer"
    assert created["department"] is None

    stored = db["users"].find_one({"email": "reviewer@example.com"})
    assert stored["role"] == "Reviewer"


def test_admin_creates_manager_with_optional_department(db):
    with_department = staff_module.create_staff_user(
        name="Manager One",
        email="manager1@example.com",
        password="Str0ngPass!",
        role="Manager",
        department="Logistics",
        actor=ADMIN,
    )

    without_department = staff_module.create_staff_user(
        name="Manager Two",
        email="manager2@example.com",
        password="Str0ngPass!",
        role="Manager",
        actor=ADMIN,
    )

    assert with_department["department"] == "Logistics"
    assert without_department["department"] is None


def test_agent_requires_a_department(db):
    with pytest.raises(HTTPException) as error:
        staff_module.create_staff_user(
            name="Agent NoDept",
            email="nodept@example.com",
            password="Str0ngPass!",
            role="Agent",
            actor=ADMIN,
        )

    assert error.value.status_code == 400
    assert db["users"].count_documents({}) == 0


def test_agent_cannot_be_created_in_unknown_department(db):
    with pytest.raises(HTTPException) as error:
        staff_module.create_staff_user(
            name="Agent Ghost",
            email="ghost@example.com",
            password="Str0ngPass!",
            role="Agent",
            department="Department That Does Not Exist",
            actor=ADMIN,
        )

    assert error.value.status_code == 400
    assert "does not exist" in error.value.detail


def test_agent_cannot_be_created_in_inactive_department(db):
    with pytest.raises(HTTPException) as error:
        staff_module.create_staff_user(
            name="Agent Retired",
            email="retired@example.com",
            password="Str0ngPass!",
            role="Agent",
            department="Retired Desk",
            actor=ADMIN,
        )

    assert error.value.status_code == 400
    assert "inactive" in error.value.detail


def test_customer_accounts_cannot_be_provisioned_here(db):
    with pytest.raises(HTTPException) as error:
        staff_module.create_staff_user(
            name="Not Staff",
            email="customer@example.com",
            password="Str0ngPass!",
            role="Customer",
            actor=ADMIN,
        )

    assert error.value.status_code == 400
    assert db["users"].count_documents({}) == 0


def test_duplicate_email_is_rejected(db):
    staff_module.create_staff_user(
        name="Agent A",
        email="dup@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    with pytest.raises(HTTPException) as error:
        staff_module.create_staff_user(
            name="Agent B",
            email="DUP@example.com",
            password="Str0ngPass!",
            role="Agent",
            department="Logistics",
            actor=ADMIN,
        )

    assert error.value.status_code == 400
    assert db["users"].count_documents({}) == 1


# ============================================================
# 2. ADMIN EDITS STAFF
# ============================================================

def test_admin_changes_agent_department(db):
    created = staff_module.create_staff_user(
        name="Agent A",
        email="agent.a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )

    updated = staff_module.update_staff_user(
        user_id=created["id"],
        department="Logistics",
        actor=ADMIN,
    )

    assert updated["department"] == "Logistics"

    stored = db["users"].find_one({
        "_id": ObjectId(created["id"]),
    })
    assert stored["department"] == "Logistics"

    audit = db["audit_logs"].find_one({
        "action": "Staff account updated",
    })
    assert audit["details"]["changes"]["department"]["after"] == (
        "Logistics"
    )


def test_admin_cannot_move_agent_to_unknown_department(db):
    created = staff_module.create_staff_user(
        name="Agent A",
        email="agent.a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    with pytest.raises(HTTPException) as error:
        staff_module.update_staff_user(
            user_id=created["id"],
            department="Nowhere",
            actor=ADMIN,
        )

    assert error.value.status_code == 400

    stored = db["users"].find_one({"_id": ObjectId(created["id"])})
    assert stored["department"] == "Logistics"


def test_promoting_agent_to_reviewer_clears_department(db):
    created = staff_module.create_staff_user(
        name="Agent A",
        email="agent.a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    updated = staff_module.update_staff_user(
        user_id=created["id"],
        role="Reviewer",
        actor=ADMIN,
    )

    assert updated["role"] == "Reviewer"
    assert updated["department"] is None


def test_admin_activates_and_deactivates_staff(db):
    created = staff_module.create_staff_user(
        name="Agent A",
        email="agent.a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    deactivated = staff_module.update_staff_user(
        user_id=created["id"],
        status="Inactive",
        actor=ADMIN,
    )
    assert deactivated["status"] == "Inactive"

    reactivated = staff_module.update_staff_user(
        user_id=created["id"],
        status="Active",
        actor=ADMIN,
    )
    assert reactivated["status"] == "Active"


def test_admin_cannot_change_own_role_or_status(db):
    admin_id = db["users"].insert_one({
        "name": "Admin One",
        "email": "admin@example.com",
        "role": "Admin",
        "status": "Active",
    }).inserted_id

    actor = {
        "id": str(admin_id),
        "name": "Admin One",
        "role": "Admin",
    }

    with pytest.raises(HTTPException):
        staff_module.update_staff_user(
            user_id=str(admin_id),
            role="Agent",
            actor=actor,
        )

    with pytest.raises(HTTPException):
        staff_module.update_staff_user(
            user_id=str(admin_id),
            status="Inactive",
            actor=actor,
        )


def test_last_active_admin_cannot_be_deactivated(db):
    admin_id = db["users"].insert_one({
        "name": "Only Admin",
        "email": "only@example.com",
        "role": "Admin",
        "status": "Active",
    }).inserted_id

    with pytest.raises(HTTPException) as error:
        staff_module.update_staff_user(
            user_id=str(admin_id),
            status="Inactive",
            actor=ADMIN,
        )

    assert "last active administrator" in error.value.detail


# ============================================================
# 3. DEPARTMENT REGISTRY
# ============================================================

def test_departments_are_listed_with_real_staff_counts(db):
    staff_module.create_staff_user(
        name="Agent A",
        email="a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )
    staff_module.create_staff_user(
        name="Agent B",
        email="b@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        status="Inactive",
        actor=ADMIN,
    )
    staff_module.create_staff_user(
        name="Manager L",
        email="m@example.com",
        password="Str0ngPass!",
        role="Manager",
        department="Logistics",
        actor=ADMIN,
    )

    result = departments_module.get_departments()

    rows = {row["name"]: row for row in result["departments"]}

    assert rows["Logistics"]["agent_count"] == 2
    assert rows["Logistics"]["active_agent_count"] == 1
    assert rows["Logistics"]["manager_count"] == 1
    assert rows["Payments & Finance"]["agent_count"] == 0


def test_admin_creates_department(db):
    created = departments_module.create_department(
        name="  Escalations Desk ",
        description="Handles executive escalations",
        actor=ADMIN,
    )

    assert created["name"] == "Escalations Desk"
    assert created["source"] == "custom"
    assert created["status"] == "Active"

    assert db["departments"].find_one({
        "name": "Escalations Desk",
    })
    assert db["audit_logs"].find_one({
        "action": "Department created",
    })


def test_duplicate_department_name_is_rejected(db):
    with pytest.raises(HTTPException) as error:
        departments_module.create_department(
            name="logistics",
            actor=ADMIN,
        )

    assert error.value.status_code == 400


def test_custom_department_rename_updates_staff(db):
    created = departments_module.create_department(
        name="Escalations Desk",
        actor=ADMIN,
    )

    staff_module.create_staff_user(
        name="Agent E",
        email="e@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Escalations Desk",
        actor=ADMIN,
    )

    departments_module.update_department(
        department_id=created["id"],
        name="Executive Escalations",
        actor=ADMIN,
    )

    assert db["users"].find_one({
        "email": "e@example.com",
    })["department"] == "Executive Escalations"


def test_routing_department_cannot_be_renamed(db):
    logistics = db["departments"].find_one({"name": "Logistics"})

    with pytest.raises(HTTPException) as error:
        departments_module.update_department(
            department_id=str(logistics["_id"]),
            name="Shipping",
            actor=ADMIN,
        )

    assert error.value.status_code == 400
    assert db["departments"].find_one({"name": "Logistics"})


def test_department_can_be_deactivated_and_reactivated(db):
    logistics = db["departments"].find_one({"name": "Logistics"})

    deactivated = departments_module.update_department(
        department_id=str(logistics["_id"]),
        status="Inactive",
        actor=ADMIN,
    )
    assert deactivated["status"] == "Inactive"

    with pytest.raises(HTTPException):
        staff_module.create_staff_user(
            name="Agent X",
            email="x@example.com",
            password="Str0ngPass!",
            role="Agent",
            department="Logistics",
            actor=ADMIN,
        )

    departments_module.update_department(
        department_id=str(logistics["_id"]),
        status="Active",
        actor=ADMIN,
    )

    staff_module.create_staff_user(
        name="Agent X",
        email="x@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    assert db["users"].count_documents({"role": "Agent"}) == 1


def test_department_staff_listing(db):
    staff_module.create_staff_user(
        name="Agent A",
        email="a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )
    staff_module.create_staff_user(
        name="Agent P",
        email="p@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )

    staff = departments_module.get_department_staff("Logistics")

    assert [member["email"] for member in staff] == ["a@example.com"]
    assert all("password" not in member for member in staff)


def test_assignable_agents_are_active_and_department_scoped(db):
    staff_module.create_staff_user(
        name="Agent Active",
        email="active@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )
    staff_module.create_staff_user(
        name="Agent Inactive",
        email="inactive@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        status="Inactive",
        actor=ADMIN,
    )
    staff_module.create_staff_user(
        name="Agent Other",
        email="other@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )

    agents = staff_module.get_assignable_agents(
        department="Logistics",
    )

    assert [agent["email"] for agent in agents] == [
        "active@example.com",
    ]


# ============================================================
# 4. DEPARTMENT ROUTING
# ============================================================

def _complaint(db, *, department, status="Analyzed"):
    return db["complaints"].insert_one({
        "title": "Charged twice",
        "description": "I was charged twice for one order.",
        "user_id": "customer-1",
        "status": status,
        "assigned_to": None,
        "assigned_department": department,
        "manual_review_required": status == "Manual Review",
        "review_status": (
            "Pending" if status == "Manual Review" else None
        ),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }).inserted_id


def test_complaint_routes_to_agent_of_its_own_department(db):
    agent_a = staff_module.create_staff_user(
        name="Agent A",
        email="a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )
    staff_module.create_staff_user(
        name="Agent B",
        email="b@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    complaint_id = _complaint(db, department="Payments & Finance")

    agent = assignment_module.auto_assign_complaint(
        complaint_object_id=complaint_id,
        complaint_id=str(complaint_id),
        department="Payments & Finance",
    )

    assert str(agent["_id"]) == agent_a["id"]

    stored = db["complaints"].find_one({"_id": complaint_id})
    assert stored["status"] == "Assigned"
    assert stored["assigned_to"] == agent_a["id"]


def test_agent_of_another_department_never_receives_the_complaint(db):
    agent_b = staff_module.create_staff_user(
        name="Agent B",
        email="b@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    complaint_id = _complaint(db, department="Payments & Finance")

    agent = assignment_module.auto_assign_complaint(
        complaint_object_id=complaint_id,
        complaint_id=str(complaint_id),
        department="Payments & Finance",
    )

    assert agent is None

    stored = db["complaints"].find_one({"_id": complaint_id})
    assert stored["assigned_to"] is None
    assert stored["status"] != "Assigned"

    activity = db["complaint_activity"].find_one({
        "complaint_id": str(complaint_id),
        "title": "Awaiting manual assignment",
    })
    assert activity is not None
    assert agent_b["id"] not in str(stored)


def test_inactive_agent_never_receives_a_complaint(db):
    staff_module.create_staff_user(
        name="Agent Inactive",
        email="inactive@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        status="Inactive",
        actor=ADMIN,
    )

    complaint_id = _complaint(db, department="Payments & Finance")

    agent = assignment_module.auto_assign_complaint(
        complaint_object_id=complaint_id,
        complaint_id=str(complaint_id),
        department="Payments & Finance",
    )

    assert agent is None
    assert db["complaints"].find_one({
        "_id": complaint_id,
    })["assigned_to"] is None


# ============================================================
# 5. REVIEWER APPROVAL -> REAL AGENT ASSIGNMENT
# ============================================================

REVIEWER = {
    "id": "reviewer-1",
    "name": "Reviewer One",
    "role": "Reviewer",
}


def _review_complaint(db, department="Payments & Finance"):
    complaint_id = _complaint(
        db,
        department=department,
        status="Manual Review",
    )

    db["analyses"].insert_one({
        "complaint_id": str(complaint_id),
        "analysis": {
            "classification": {
                "category": "Billing & Payments",
                "subcategory": "Duplicate charge",
                "department": department,
            },
        },
    })

    return complaint_id


def test_reviewer_approval_assigns_a_real_agent(db):
    agent = staff_module.create_staff_user(
        name="Agent A",
        email="a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )

    complaint_id = _review_complaint(db)

    result = review_module.approve_review(
        complaint_id=str(complaint_id),
        reviewer=REVIEWER,
        comment="Classification is correct.",
    )

    assert result["status"] == "Assigned"
    assert result["assigned_agent"]["id"] == agent["id"]

    stored = db["complaints"].find_one({"_id": complaint_id})

    assert stored["status"] == "Assigned"
    assert stored["assigned_to"] == agent["id"]
    assert stored["review_status"] == "Completed"
    assert stored["manual_review_required"] is False

    titles = [
        entry["title"]
        for entry in db["complaint_activity"].find({
            "complaint_id": str(complaint_id),
        })
    ]
    assert "Complaint automatically assigned to Agent" in titles


def test_approved_complaint_is_never_assigned_without_an_owner(db):
    """The orphan state (status Assigned, assigned_to null) is gone."""

    # Only an agent from a DIFFERENT department exists.
    staff_module.create_staff_user(
        name="Agent B",
        email="b@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    complaint_id = _review_complaint(db)

    result = review_module.approve_review(
        complaint_id=str(complaint_id),
        reviewer=REVIEWER,
        comment="Approved.",
    )

    stored = db["complaints"].find_one({"_id": complaint_id})

    assert result["status"] != "Assigned"
    assert stored["status"] == "Analyzed"
    assert stored["assigned_to"] is None

    # Invariant across every complaint in the database.
    for complaint in db["complaints"].find({}):
        if complaint.get("status") == "Assigned":
            assert complaint.get("assigned_to")


def test_reviewer_approval_puts_the_complaint_in_the_agent_queue(db):
    agent = staff_module.create_staff_user(
        name="Agent A",
        email="a@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Payments & Finance",
        actor=ADMIN,
    )

    complaint_id = _review_complaint(db)

    review_module.approve_review(
        complaint_id=str(complaint_id),
        reviewer=REVIEWER,
        comment="Approved.",
    )

    # The agent queue is `assigned_to == agent id`.
    queue = list(db["complaints"].find({
        "assigned_to": agent["id"],
    }))
    assert [str(item["_id"]) for item in queue] == [
        str(complaint_id),
    ]

    other_agent = staff_module.create_staff_user(
        name="Agent B",
        email="b@example.com",
        password="Str0ngPass!",
        role="Agent",
        department="Logistics",
        actor=ADMIN,
    )

    assert db["complaints"].count_documents({
        "assigned_to": other_agent["id"],
    }) == 0


# ============================================================
# 6. ROUTE REGISTRATION AND RBAC
# ============================================================

@pytest.fixture(scope="module")
def app():
    return load_app()


NEW_ENDPOINTS = {
    ("/api/admin/users", "POST"): {"Admin"},
    ("/api/admin/users/{user_id}", "PATCH"): {"Admin"},
    ("/api/admin/departments", "POST"): {"Admin"},
    (
        "/api/admin/departments/{department_id}",
        "PATCH",
    ): {"Admin"},
    (
        "/api/admin/departments/{department_name}/staff",
        "GET",
    ): {"Manager", "Admin"},
    ("/api/admin/agents", "GET"): {
        "Reviewer",
        "Manager",
        "Admin",
    },
    ("/api/departments", "GET"): {
        "Agent",
        "Reviewer",
        "Manager",
        "Admin",
    },
}


def allowed_roles_for(app, path, method):
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

            for cell in call.__closure__ or ():
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
        for (path, method), roles in NEW_ENDPOINTS.items()
    ],
)
def test_new_endpoints_are_registered_and_role_guarded(
    app,
    path,
    method,
    roles,
):
    routes = route_map(app)

    assert path in routes, f"{path} is not registered"
    assert method in routes[path]

    names = route_dependencies(app, path, method) or []
    assert any("role_checker" in name for name in names), (
        f"{method} {path} is not guarded by require_roles"
    )

    assert allowed_roles_for(app, path, method) == roles


def test_public_registration_can_only_create_customers(app, monkeypatch):
    """A public register request cannot self-assign a staff role."""

    from fastapi.testclient import TestClient

    collections = install_memory_database(monkeypatch)

    client = TestClient(app)

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Sneaky User",
            "email": "sneaky@example.com",
            "password": "Str0ngPass!",
            "role": "Admin",
            "department": "Payments & Finance",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["role"] == "Customer"

    stored = collections["users"].find_one({
        "email": "sneaky@example.com",
    })

    assert stored["role"] == "Customer"
    assert stored.get("department") is None


def test_customer_cannot_reach_staff_provisioning(app, monkeypatch):
    from fastapi.testclient import TestClient

    import api.main as main

    install_memory_database(monkeypatch)

    def fake_current_user():
        return {
            "id": "customer-1",
            "name": "Customer",
            "email": "customer@example.com",
            "role": "Customer",
        }

    app.dependency_overrides[main.get_current_user] = (
        fake_current_user
    )

    client = TestClient(app)

    try:
        for method, path, payload in [
            ("post", "/api/admin/users", {
                "name": "Agent A",
                "email": "a@example.com",
                "password": "Str0ngPass!",
                "role": "Agent",
                "department": "Logistics",
            }),
            ("post", "/api/admin/departments", {"name": "Mine"}),
            ("get", "/api/departments", None),
        ]:
            response = (
                client.post(path, json=payload)
                if method == "post"
                else client.get(path)
            )

            assert response.status_code == 403, (
                f"{method.upper()} {path} returned "
                f"{response.status_code}"
            )
    finally:
        app.dependency_overrides.clear()


# ============================================================
# 9. PROFILE RESPONSE CONSUMED BY THE FRONTEND
# ============================================================

def test_auth_me_returns_the_stored_staff_profile(app, monkeypatch):
    """
    GET /api/auth/me must return the stored department, status and
    creation date.

    The Profile and Settings screens read those fields straight from
    this response; when the API omitted them the frontend had to
    invent values, which is exactly what must not happen.
    """

    from fastapi.testclient import TestClient

    import api.main as main

    collections = install_memory_database(monkeypatch)

    created_at = datetime(2026, 2, 3, 9, 30, tzinfo=timezone.utc)

    inserted = collections["users"].insert_one({
        "name": "Agent A",
        "email": "agent.a@example.com",
        "password": "hashed-not-returned",
        "role": "Agent",
        "department": "Payments & Finance",
        "status": "Active",
        "phone": "+1 555 0100",
        "created_at": created_at,
    })

    user_id = str(inserted.inserted_id)

    def fake_current_user():
        return {
            "id": user_id,
            "name": "Agent A",
            "email": "agent.a@example.com",
            "role": "Agent",
        }

    app.dependency_overrides[main.get_current_user] = fake_current_user

    client = TestClient(app)

    try:
        response = client.get("/api/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["id"] == user_id
    assert body["role"] == "Agent"
    assert body["department"] == "Payments & Finance"
    assert body["status"] == "Active"
    assert body["phone"] == "+1 555 0100"
    assert body["created_at"] is not None

    # The password hash must never leave the server.
    assert "password" not in body


def test_auth_me_omits_department_for_a_customer(app, monkeypatch):
    """A customer has no department: the field is null, not guessed."""

    from fastapi.testclient import TestClient

    import api.main as main

    collections = install_memory_database(monkeypatch)

    inserted = collections["users"].insert_one({
        "name": "Casey Customer",
        "email": "casey@example.com",
        "password": "hashed",
        "role": "Customer",
        "status": "Active",
        "created_at": datetime.now(timezone.utc),
    })

    user_id = str(inserted.inserted_id)

    app.dependency_overrides[main.get_current_user] = lambda: {
        "id": user_id,
        "name": "Casey Customer",
        "email": "casey@example.com",
        "role": "Customer",
    }

    client = TestClient(app)

    try:
        body = client.get("/api/auth/me").json()
    finally:
        app.dependency_overrides.clear()

    assert body["role"] == "Customer"
    assert body["department"] is None
    assert body["phone"] is None
