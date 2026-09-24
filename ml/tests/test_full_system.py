import sys
import os


sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

import pandas as pd

# Allow imports from ml/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rule_engine import analyze_complaint
from validator import validate_result


# ============================================================
# CONFIGURATION
# ============================================================

DATASET_PATH = "ml/data/complaints.csv"
REPORT_PATH = "ml/reports/full_system_validation.csv"


# ============================================================
# LOAD DATASET
# ============================================================

print("\n" + "=" * 70)
print("SUPPORTNOVA FULL SYSTEM VALIDATION")
print("=" * 70)

dataset = pd.read_csv(DATASET_PATH)

print(f"\nComplaints loaded: {len(dataset)}")


# ============================================================
# VALIDATE EACH COMPLAINT
# ============================================================

results = []

engine_errors = 0
system_valid = 0
system_invalid = 0
escalated_count = 0
security_flagged_count = 0


for index, row in dataset.iterrows():

    complaint_text = str(row.get("Complaint_Text", ""))

    try:

        # ----------------------------------------------------
        # Run complete rule engine
        # ----------------------------------------------------

        engine_result = analyze_complaint(
            complaint_text
        )

        # ----------------------------------------------------
        # Independent validation
        # ----------------------------------------------------

        validation = validate_result(
            engine_result
        )

        classification = engine_result.get(
            "classification",
            {}
        )

        routing = engine_result.get(
            "routing",
            {}
        )

        escalation = engine_result.get(
            "escalation",
            {}
        )

        security = engine_result.get(
            "security",
            {}
        )

        predicted_category = classification.get(
            "category"
        )

        predicted_subcategory = classification.get(
            "subcategory"
        )

        predicted_department = classification.get(
            "department"
        )

        primary_department = routing.get(
            "primary_department"
        )

        priority = engine_result.get(
            "priority"
        )

        sla_hours = engine_result.get(
            "sla_hours"
        )

        escalation_ids = escalation.get(
            "rule_ids",
            []
        )

        policies = engine_result.get(
            "policies",
            []
        )

        resolution_rules = engine_result.get(
            "resolution_rules",
            []
        )

        security_flagged = security.get(
            "flagged",
            False
        )

        prompt_injection = security.get(
            "prompt_injection",
            False
        )

        secret_request = security.get(
            "secret_request",
            False
        )

        if escalation_ids:
            escalated_count += 1

        if security_flagged:
            security_flagged_count += 1

        if validation.valid:
            system_valid += 1
        else:
            system_invalid += 1

        results.append({
            "row": index + 1,

            "complaint": complaint_text,

            "expected_category": row.get(
                "Category"
            ),

            "predicted_category": predicted_category,

            "expected_subcategory": row.get(
                "Subcategory"
            ),

            "predicted_subcategory": predicted_subcategory,

            "expected_department": row.get(
                "Assigned_Department"
            ),

            "predicted_department": predicted_department,

            "primary_department": primary_department,

            "priority": priority,

            "sla_hours": sla_hours,

            "escalation_count": len(
                escalation_ids
            ),

            "escalation_ids": ",".join(
                escalation_ids
            ),

            "policy_count": len(
                policies
            ),

            "resolution_rule_count": len(
                resolution_rules
            ),

            "security_flagged": security_flagged,

            "prompt_injection": prompt_injection,

            "secret_request": secret_request,

            "validation_valid": validation.valid,

            "validation_errors": " | ".join(
                validation.errors
            ),

            "engine_error": ""

        })

    except Exception as e:

        engine_errors += 1

        results.append({
            "row": index + 1,

            "complaint": complaint_text,

            "expected_category": row.get(
                "Category"
            ),

            "predicted_category": "",

            "expected_subcategory": row.get(
                "Subcategory"
            ),

            "predicted_subcategory": "",

            "expected_department": row.get(
                "Assigned_Department"
            ),

            "predicted_department": "",

            "primary_department": "",

            "priority": "",

            "sla_hours": "",

            "escalation_count": 0,

            "escalation_ids": "",

            "policy_count": 0,

            "resolution_rule_count": 0,

            "security_flagged": False,

            "prompt_injection": False,

            "secret_request": False,

            "validation_valid": False,

            "validation_errors": "",

            "engine_error": str(e)

        })


# ============================================================
# SAVE REPORT
# ============================================================

os.makedirs(
    os.path.dirname(REPORT_PATH),
    exist_ok=True
)

report = pd.DataFrame(results)

report.to_csv(
    REPORT_PATH,
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("FULL SYSTEM VALIDATION SUMMARY")
print("=" * 70)

print(
    f"\nTotal complaints:       {len(dataset)}"
)

print(
    f"System-valid:           {system_valid}"
)

print(
    f"System-invalid:         {system_invalid}"
)

print(
    f"Engine errors:          {engine_errors}"
)

print(
    f"Escalated complaints:   {escalated_count}"
)

print(
    f"Security flagged:       {security_flagged_count}"
)

if len(dataset) > 0:

    validity = (
        system_valid / len(dataset)
    ) * 100

    print(
        f"System validity:        {validity:.2f}%"
    )


print(
    f"\nReport saved to:"
)

print(
    REPORT_PATH
)


print("\n" + "=" * 70)

if (
    system_invalid == 0
    and engine_errors == 0
):

    print(
        "FULL SYSTEM VALIDATION PASSED."
    )

else:

    print(
        "FULL SYSTEM VALIDATION FOUND ISSUES."
    )

print("=" * 70)