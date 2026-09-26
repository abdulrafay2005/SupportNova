from fastapi import HTTPException


ROLES = {
    "Customer",
    "Agent",
    "Reviewer",
    "Manager",
    "Admin",
}


PERMISSIONS = {
    "Customer": {
        "complaints:create",
        "complaints:view_own",
        "complaints:view_analysis_own",
    },

    "Agent": {
        "complaints:view_assigned",
        "complaints:update_assigned",
        "complaints:resolve",
        "complaints:escalate",
    },

    "Reviewer": {
        "complaints:view_assigned",
        "review:view",
        "review:approve",
        "review:modify",
        "review:reclassify",
        "review:reassign",
        "review:escalate",
        "review:regenerate",
        "review:comment",
    },

    "Manager": {
        "complaints:view_all",
        "complaints:assign",
        "complaints:reassign",
        "escalations:view",
        "sla:view",
        "analytics:view",
        "reports:view",
    },

    "Admin": {
        "complaints:view_all",
        "complaints:assign",
        "complaints:reassign",
        "escalations:view",
        "sla:view",
        "analytics:view",
        "reports:view",
        "users:manage",
        "documents:manage",
        "rules:manage",
        "audit:view",
    },
}


def has_permission(role: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(role, set())


def require_permission(current_user: dict, permission: str):
    if not has_permission(
        current_user["role"],
        permission
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to perform this action"
        )

    return current_user