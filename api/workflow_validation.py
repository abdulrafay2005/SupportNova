from ml.schema_validator import validate_complaint_result
from ml.validator import validate_result


def _has_security_escalation(analysis: dict) -> bool:
    """
    Detect security-sensitive complaints using the deterministic
    Rule Engine output.
    """

    classification = analysis.get(
        "classification",
        {}
    )

    escalation = analysis.get(
        "escalation",
        {}
    )

    category = str(
        classification.get("category", "")
    ).strip().lower()

    subcategory = str(
        classification.get("subcategory", "")
    ).strip().lower()

    # Account & Security is inherently security-sensitive.
    if category == "account & security":
        return True

    security_terms = (
        "account takeover",
        "unauthorized access",
        "credential compromise",
        "personal data",
        "security",
    )

    if any(
        term in subcategory
        for term in security_terms
    ):
        return True

    # Check deterministic escalation rules.
    for rule in escalation.get("rules", []):

        if not isinstance(rule, dict):
            continue

        condition_name = str(
            rule.get("Condition_Name", "")
        ).lower()

        responsible_department = str(
            rule.get("Responsible_Department", "")
        ).lower()

        if (
            "takeover" in condition_name
            or "credential" in condition_name
            or "security" in condition_name
            or responsible_department == "account security"
        ):
            return True

    return False


def _has_unclear_escalation(analysis: dict) -> bool:
    """
    Escalation is unclear when it is required but the Rule Engine
    did not provide a usable escalation rule.
    """

    escalation = analysis.get(
        "escalation",
        {}
    )

    if not escalation.get("required"):
        return False

    rules = escalation.get("rules") or []
    rule_ids = escalation.get("rule_ids") or []

    return (
        len(rules) == 0
        and len(rule_ids) == 0
    )


def _has_policy_conflict(analysis: dict) -> bool:
    """
    Detect explicit policy conflict signals if they exist
    in the deterministic analysis.
    """

    complaint = analysis.get(
        "complaint",
        {}
    )

    security = analysis.get(
        "security",
        {}
    )

    conflict_keys = {
        "policy_conflict",
        "policy_contradiction",
        "conflicting_policy",
        "conflicting_policies",
    }

    for key in conflict_keys:

        if complaint.get(key):
            return True

        if security.get(key):
            return True

    return False


def _validate_ground_truth(analysis: dict, rule_result: dict) -> dict:
    """
    Run both structural schema validation and the independent
    deterministic ground-truth validator.

    The Rule Engine result is used for ground-truth validation
    because it is the deterministic source of truth.
    """

    try:

        schema_result = validate_complaint_result(
            analysis
        )

        ground_truth_result = validate_result(
            rule_result
        )

        return {
            "valid": (
                bool(schema_result.get("valid", False))
                and bool(ground_truth_result.valid)
            ),

            "schema_result": schema_result,

            "ground_truth_result": {
                "valid": bool(
                    ground_truth_result.valid
                ),
                "errors": ground_truth_result.errors,
                "warnings": ground_truth_result.warnings,
            }
        }

    except Exception as exc:

        return {
            "valid": False,

            "schema_result": {
                "valid": False,
                "error": str(exc)
            },

            "ground_truth_result": {
                "valid": False,
                "errors": [
                    str(exc)
                ],
                "warnings": []
            }
        }
    
def validate_workflow(analysis: dict,rule_result: dict) -> dict:
    """
    Decide whether an analyzed complaint can continue through
    automated workflow or requires human review.

    This function does NOT perform classification and does NOT
    replace the existing ML validators.
    """

    issues = []

    # ========================================================
    # 1. Ground-truth validation
    # ========================================================

    ground_truth = _validate_ground_truth(
        analysis,rule_result
    )

    if not ground_truth["valid"]:

        error = ground_truth["result"].get(
            "error"
        )

        issues.append({
            "code": "WF001",
            "type": "ground_truth_validation_failed",
            "message": (
                "The deterministic complaint analysis "
                "failed ground-truth validation."
            ),
          
        })

    # ========================================================
    # 2. Missing policy support
    # ========================================================

    policies = analysis.get(
        "policies",
        []
    )

    if not policies:

        issues.append({
            "code": "WF002",
            "type": "missing_policy_support",
            "message": (
                "No active policy was matched to "
                "the complaint."
            ),
        })

    # ========================================================
    # 3. Unclear escalation
    # ========================================================

    if _has_unclear_escalation(analysis):

        issues.append({
            "code": "WF003",
            "type": "unclear_escalation",
            "message": (
                "Escalation is required but no usable "
                "escalation rule was provided."
            ),
        })

    # ========================================================
    # 4. Security-sensitive case
    # ========================================================

    if _has_security_escalation(analysis):

        issues.append({
            "code": "WF004",
            "type": "security_sensitive_case",
            "message": (
                "The complaint is security-sensitive "
                "and requires reviewer handling."
            ),
        })

    # ========================================================
    # 5. Policy conflict
    # ========================================================

    if _has_policy_conflict(analysis):

        issues.append({
            "code": "WF005",
            "type": "policy_conflict",
            "message": (
                "The analysis contains a policy conflict "
                "or contradiction."
            ),
        })

    # ========================================================
    # Final decision
    # ========================================================

    manual_review_required = len(issues) > 0

    return {
        "status": (
            "Manual Review"
            if manual_review_required
            else "Passed"
        ),

        "manual_review_required": (
            manual_review_required
        ),

        "issues": issues,

        "ground_truth_valid": (
            ground_truth["valid"]
        ),

        "ground_truth_result": (
    ground_truth.get(
        "ground_truth_result"
    )
),
    }