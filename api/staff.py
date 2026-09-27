"""
Administrator staff provisioning.

Public registration (`POST /api/auth/register`) always creates a
Customer and must never be able to create a privileged account.
Privileged accounts (Agent / Reviewer / Manager / Admin) are created
here, by an authenticated Administrator, and every action is audited.

Nothing in this module invents data: passwords are hashed with the
existing `api.auth` helpers, departments are validated against the
real department registry, and the stored user document uses exactly
the same shape the rest of the application already reads
(`name`, `email`, `password`, `role`, `status`, `department`,
`created_at`).
"""

from datetime import datetime, timezone

from fastapi import HTTPException

from api.audit import create_audit_log
from api.auth import hash_password
from api.database import users_collection
from api.departments import require_active_department


# Roles an administrator may provision from the Admin dashboard.
STAFF_ROLES = ["Agent", "Reviewer", "Manager", "Admin"]

# Roles that must belong to a department to be able to work:
# automatic routing matches complaints to Agents by department.
DEPARTMENT_REQUIRED_ROLES = {"Agent"}

# Roles for which a department is meaningful but optional.
DEPARTMENT_OPTIONAL_ROLES = {"Manager"}

USER_STATUSES = {"Active", "Inactive"}


def _serialize(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "department": user.get("department"),
        "status": user.get("status"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


def _resolve_department(role: str, department: str | None) -> str | None:
    """
    Apply the department rules for a role.

    Agent  -> required, must exist and be active.
    Manager-> optional, validated when supplied.
    Reviewer / Admin -> organisation-wide, never department bound.
    """

    clean = (department or "").strip()

    if role in DEPARTMENT_REQUIRED_ROLES:
        if not clean:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A department is required for Agent accounts: "
                    "complaints are routed to agents by department."
                ),
            )

        return require_active_department(clean)

    if role in DEPARTMENT_OPTIONAL_ROLES:
        if not clean:
            return None

        return require_active_department(clean)

    # Reviewer / Admin work across departments in this architecture.
    return None


def create_staff_user(
    *,
    name: str,
    email: str,
    password: str,
    role: str,
    department: str | None = None,
    status: str = "Active",
    actor: dict,
):
    if role not in STAFF_ROLES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only Agent, Reviewer, Manager and Admin accounts "
                "can be created here. Customers register themselves."
            ),
        )

    if status not in USER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid user status",
        )

    clean_name = " ".join((name or "").split())

    if len(clean_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Name must be at least 2 characters",
        )

    clean_email = (email or "").lower().strip()

    if users_collection.find_one({"email": clean_email}):
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    resolved_department = _resolve_department(role, department)

    document = {
        "name": clean_name,
        "email": clean_email,

        # Password is NEVER stored as plaintext and is never
        # written to the audit trail or returned to the client.
        "password": hash_password(password),

        "role": role,
        "status": status,
        "department": resolved_department,
        "created_at": datetime.now(timezone.utc),
        "created_by": actor["id"],
    }

    result = users_collection.insert_one(document)

    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="Staff account created",
        entity_type="user",
        entity_id=str(result.inserted_id),
        details={
            "name": clean_name,
            "email": clean_email,
            "role": role,
            "department": resolved_department,
            "status": status,
        },
    )

    document["_id"] = result.inserted_id

    return _serialize(document)


def update_staff_user(
    *,
    user_id: str,
    name: str | None = None,
    role: str | None = None,
    department: str | None = None,
    status: str | None = None,
    actor: dict,
):
    from api.management import _object_id

    object_id = _object_id(user_id, "user ID")

    user = users_collection.find_one({"_id": object_id})

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    is_self = str(user["_id"]) == actor["id"]

    updates: dict = {}
    changes: dict = {}

    # ----------------------------------------------------
    # Name
    # ----------------------------------------------------
    if name is not None:
        clean_name = " ".join(name.split())

        if len(clean_name) < 2:
            raise HTTPException(
                status_code=400,
                detail="Name must be at least 2 characters",
            )

        if clean_name != user.get("name"):
            updates["name"] = clean_name
            changes["name"] = {
                "before": user.get("name"),
                "after": clean_name,
            }

    # ----------------------------------------------------
    # Role
    # ----------------------------------------------------
    target_role = user.get("role")

    if role is not None and role != user.get("role"):
        if role not in STAFF_ROLES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Accounts can only be changed to Agent, "
                    "Reviewer, Manager or Admin"
                ),
            )

        if is_self:
            raise HTTPException(
                status_code=400,
                detail="You cannot change your own role",
            )

        if user.get("role") == "Admin":
            remaining_admins = users_collection.count_documents({
                "role": "Admin",
                "status": "Active",
                "_id": {"$ne": object_id},
            })

            if remaining_admins == 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This is the last active administrator "
                        "account and its role cannot be changed"
                    ),
                )

        target_role = role
        updates["role"] = role
        changes["role"] = {
            "before": user.get("role"),
            "after": role,
        }

    # ----------------------------------------------------
    # Department
    #
    # Re-validated whenever the department OR the role changes,
    # because the rules differ per role.
    # ----------------------------------------------------
    if department is not None or "role" in updates:
        candidate = (
            department
            if department is not None
            else user.get("department")
        )

        resolved = _resolve_department(target_role, candidate)

        if resolved != user.get("department"):
            updates["department"] = resolved
            changes["department"] = {
                "before": user.get("department"),
                "after": resolved,
            }

    # ----------------------------------------------------
    # Status
    # ----------------------------------------------------
    if status is not None and status != user.get("status"):
        if status not in USER_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid user status",
            )

        if is_self:
            raise HTTPException(
                status_code=400,
                detail=(
                    "You cannot change your own account status"
                ),
            )

        if (
            user.get("role") == "Admin"
            and status == "Inactive"
        ):
            remaining_admins = users_collection.count_documents({
                "role": "Admin",
                "status": "Active",
                "_id": {"$ne": object_id},
            })

            if remaining_admins == 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This is the last active administrator "
                        "account and it cannot be deactivated"
                    ),
                )

        updates["status"] = status
        changes["status"] = {
            "before": user.get("status"),
            "after": status,
        }

    if not updates:
        return _serialize(user)

    updates["updated_at"] = datetime.now(timezone.utc)

    users_collection.update_one(
        {"_id": object_id},
        {"$set": updates},
    )

    create_audit_log(
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="Staff account updated",
        entity_type="user",
        entity_id=user_id,
        details={"changes": changes},
    )

    updated = users_collection.find_one({"_id": object_id})

    return _serialize(updated or {**user, **updates})


def get_assignable_agents(*, department: str | None = None):
    """
    Active agents an administrator or manager can assign work to.

    Used by the frontend so assignment pickers only ever show real,
    active agents from the correct department.
    """

    query = {"role": "Agent", "status": "Active"}

    if department:
        query["department"] = department

    agents = list(
        users_collection.find(query, {"password": 0}).sort("name", 1)
    )

    return [
        {
            "id": str(agent["_id"]),
            "name": agent.get("name"),
            "email": agent.get("email"),
            "department": agent.get("department"),
            "status": agent.get("status"),
        }
        for agent in agents
    ]
