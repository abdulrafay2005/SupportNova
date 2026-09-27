"""
Department registry.

SupportNova already has one department concept: the routing
taxonomy the deterministic rule engine emits (`ml/data/departments.csv`),
which is written to `complaints.assigned_department` and to
`users.department`. This module does NOT introduce a second model —
it persists that same taxonomy in a `departments` collection so the
Admin UI can read real department data from the backend instead of
hardcoding names, and so administrators can add their own
departments on top of it.

Rules:

* Departments seeded from the routing taxonomy are marked
  `source="system"`. Their NAME cannot be changed, because the rule
  engine emits those exact strings and renaming one would silently
  break routing. Description and status remain editable.
* Administrator-created departments are `source="custom"` and can be
  renamed; the rename is propagated to `users.department` so staff
  records never point at a department that no longer exists.
* Deactivating a department does not touch existing staff or
  complaints. It only prevents NEW staff from being assigned to it.
"""

import csv
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from api.audit import create_audit_log
from api.database import departments_collection, users_collection


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DEPARTMENT_SOURCE_FILE = (
    PROJECT_ROOT / "ml" / "data" / "departments.csv"
)

DEPARTMENT_STATUSES = {"Active", "Inactive"}

STAFF_ROLES = {"Agent", "Reviewer", "Manager", "Admin"}


# ============================================================
# CANONICAL ROUTING TAXONOMY
# ============================================================

def load_routing_departments() -> list[dict]:
    """
    Read the department taxonomy the rule engine routes to.

    Returns [] when the data file is unavailable: a missing file
    must never prevent the API from starting.
    """

    try:
        with DEPARTMENT_SOURCE_FILE.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as handle:
            rows = list(csv.DictReader(handle))
    except Exception:  # pragma: no cover - environment dependent
        return []

    departments = []

    for row in rows:
        name = (row.get("Department_Name") or "").strip()

        if not name:
            continue

        departments.append({
            "name": name,
            "code": (row.get("Department_ID") or "").strip(),
            "description": (
                row.get("Responsibility") or ""
            ).strip(),
        })

    return departments


def ensure_departments_seeded():
    """
    Persist the routing taxonomy once, idempotently.

    Existing documents are never overwritten, so administrator edits
    to a system department's description or status survive restarts.
    Failures are reported, never raised.
    """

    created = []

    try:
        for entry in load_routing_departments():
            existing = departments_collection.find_one({
                "name": entry["name"],
            })

            if existing:
                continue

            departments_collection.insert_one({
                "name": entry["name"],
                "code": entry["code"],
                "description": entry["description"],
                "status": "Active",
                "source": "system",
                "created_at": datetime.now(timezone.utc),
            })

            created.append(entry["name"])

    except Exception as error:  # pragma: no cover - env dependent
        print(f"Department seeding skipped: {error}")

    return created


# ============================================================
# HELPERS
# ============================================================

def _normalize_name(value: str) -> str:
    return " ".join((value or "").split())


def _staff_counts() -> dict:
    """Real staff head-count per department, by role."""

    counts: dict = {}

    for user in users_collection.find(
        {"role": {"$in": list(STAFF_ROLES)}},
        {"role": 1, "department": 1, "status": 1},
    ):
        department = user.get("department")

        if not department:
            continue

        bucket = counts.setdefault(
            department,
            {
                "staff_count": 0,
                "agent_count": 0,
                "active_agent_count": 0,
                "manager_count": 0,
            },
        )

        bucket["staff_count"] += 1

        if user.get("role") == "Agent":
            bucket["agent_count"] += 1

            if user.get("status") == "Active":
                bucket["active_agent_count"] += 1

        elif user.get("role") == "Manager":
            bucket["manager_count"] += 1

    return counts


def _serialize(department: dict, counts: dict) -> dict:
    name = department.get("name")

    bucket = counts.get(name, {})

    return {
        "id": str(department["_id"]),
        "name": name,
        "code": department.get("code") or None,
        "description": department.get("description") or "",
        "status": department.get("status", "Active"),
        "source": department.get("source", "custom"),
        "created_at": department.get("created_at"),
        "staff_count": bucket.get("staff_count", 0),
        "agent_count": bucket.get("agent_count", 0),
        "active_agent_count": bucket.get(
            "active_agent_count",
            0,
        ),
        "manager_count": bucket.get("manager_count", 0),
    }


def get_department_document(name: str):
    """Case-insensitive department lookup by name."""

    clean = _normalize_name(name)

    if not clean:
        return None

    for department in departments_collection.find({}):
        if (
            _normalize_name(
                department.get("name", "")
            ).lower() == clean.lower()
        ):
            return department

    return None


def require_active_department(name: str) -> str:
    """
    Validate that a department exists and is active.

    Returns the canonical stored name so staff records always use
    the exact spelling the routing taxonomy uses.
    """

    department = get_department_document(name)

    if not department:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Department '{name}' does not exist. "
                "Create it first in Departments."
            ),
        )

    if department.get("status") != "Active":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Department '{department.get('name')}' is "
                "inactive and cannot receive staff."
            ),
        )

    return department.get("name")


# ============================================================
# READ
# ============================================================

def get_departments(*, status: str | None = None):
    query = {}

    if status:
        query["status"] = status

    departments = list(
        departments_collection.find(query).sort("name", 1)
    )

    counts = _staff_counts()

    rows = [
        _serialize(department, counts)
        for department in departments
    ]

    return {
        "count": len(rows),
        "departments": rows,
        "routing_taxonomy_size": len(
            load_routing_departments()
        ),
    }


def get_department_staff(department_name: str):
    """Staff currently attached to one department."""

    staff = list(
        users_collection.find(
            {
                "role": {"$in": list(STAFF_ROLES)},
                "department": department_name,
            },
            {"password": 0},
        ).sort("name", 1)
    )

    return [
        {
            "id": str(member["_id"]),
            "name": member.get("name"),
            "email": member.get("email"),
            "role": member.get("role"),
            "status": member.get("status"),
        }
        for member in staff
    ]


# ============================================================
# WRITE
# ============================================================

def create_department(
    *,
    name: str,
    description: str = "",
    actor: dict,
):
    clean_name = _normalize_name(name)

    if len(clean_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Department name must be at least 2 characters",
        )

    if get_department_document(clean_name):
        raise HTTPException(
            status_code=400,
            detail="A department with that name already exists",
        )

    document = {
        "name": clean_name,
        "code": None,
        "description": (description or "").strip(),
        "status": "Active",
        "source": "custom",
        "created_at": datetime.now(timezone.utc),
    }

    result = departments_collection.insert_one(document)

    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="Department created",
        entity_type="department",
        entity_id=str(result.inserted_id),
        details={"name": clean_name},
    )

    document["_id"] = result.inserted_id

    return _serialize(document, _staff_counts())


def update_department(
    *,
    department_id: str,
    name: str | None = None,
    description: str | None = None,
    status: str | None = None,
    actor: dict,
):
    from api.management import _object_id

    object_id = _object_id(department_id, "department ID")

    department = departments_collection.find_one({
        "_id": object_id,
    })

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    updates = {}
    changes = {}

    # ----------------------------------------------------
    # Name
    # ----------------------------------------------------
    if name is not None:
        clean_name = _normalize_name(name)

        if clean_name.lower() != _normalize_name(
            department.get("name", "")
        ).lower():

            if department.get("source") == "system":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Routing departments cannot be renamed: the "
                        "complaint classification engine routes to "
                        "this exact name."
                    ),
                )

            if len(clean_name) < 2:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Department name must be at least "
                        "2 characters"
                    ),
                )

            if get_department_document(clean_name):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "A department with that name already exists"
                    ),
                )

            updates["name"] = clean_name
            changes["name"] = {
                "before": department.get("name"),
                "after": clean_name,
            }

    # ----------------------------------------------------
    # Description
    # ----------------------------------------------------
    if description is not None:
        updates["description"] = description.strip()

    # ----------------------------------------------------
    # Status
    # ----------------------------------------------------
    if status is not None:
        if status not in DEPARTMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid department status",
            )

        if status != department.get("status"):
            updates["status"] = status
            changes["status"] = {
                "before": department.get("status"),
                "after": status,
            }

    if not updates:
        return _serialize(department, _staff_counts())

    departments_collection.update_one(
        {"_id": object_id},
        {"$set": updates},
    )

    # Keep staff records consistent with a renamed department.
    if "name" in updates:
        users_collection.update_many(
            {"department": department.get("name")},
            {"$set": {"department": updates["name"]}},
        )

    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="Department updated",
        entity_type="department",
        entity_id=department_id,
        details={"changes": changes},
    )

    updated = departments_collection.find_one({
        "_id": object_id,
    }) or {**department, **updates}

    return _serialize(updated, _staff_counts())
