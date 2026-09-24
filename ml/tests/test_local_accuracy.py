import csv
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
# ============================================================
# CONFIG
# ============================================================

CSV_FILE = "ml/data/e2e_test.csv"

# Set to None to test ALL rows.
# Set to 10 if you only want the first 10.
LIMIT = None


# ============================================================
# HELPERS
# ============================================================

def normalize(value):
    if value is None:
        return ""

    return str(value).strip().lower()


def as_bool(value):
    if isinstance(value, bool):
        return value

    return normalize(value) in {
        "true",
        "1",
        "yes",
        "y",
    }


# ============================================================
# LOAD DATASET
# ============================================================

with open(CSV_FILE, "r", encoding="utf-8-sig", newline="") as file:
    reader = csv.DictReader(file)
    tests = list(reader)

if LIMIT is not None:
    tests = tests[:LIMIT]


print("=" * 70)
print("SUPPORTNOVA LOCAL RULE ENGINE ACCURACY TEST")
print("=" * 70)

print(f"\nTest dataset: {CSV_FILE}")
print(f"Total test complaints: {len(tests)}")
print("Mode: LOCAL")
print("OpenAI API: NOT USED")
print()


# ============================================================
# COUNTERS
# ============================================================

category_correct = 0
subcategory_correct = 0
department_correct = 0
escalation_correct = 0

failures = []


# ============================================================
# RUN TESTS
# ============================================================

for index, row in enumerate(tests, start=1):

    complaint = row.get("Complaint_Text", "").strip()

    expected_category = row.get("Expected_Category", "")
    expected_subcategory = row.get("Expected_Subcategory", "")
    expected_department = row.get("Expected_Department", "")
    expected_escalation = row.get("Expected_Escalation", "")

    try:

        # ====================================================
        # DIRECT LOCAL RULE ENGINE CALL
        # ====================================================

        result = analyze_complaint(complaint)

        classification = result.get("classification", {})
        escalation = result.get("escalation", {})

        actual_category = classification.get("category")
        actual_subcategory = classification.get("subcategory")
        actual_department = classification.get("department")

        actual_escalation = escalation.get("required", False)

    except Exception as error:

        print(f"\n[ERROR] Test #{index}")
        print(f"Complaint: {complaint}")
        print(f"Error: {error}")

        failures.append({
            "test": index,
            "complaint": complaint,
            "error": str(error)
        })

        continue


    # ========================================================
    # COMPARE
    # ========================================================

    category_ok = (
        normalize(actual_category)
        == normalize(expected_category)
    )

    subcategory_ok = (
        normalize(actual_subcategory)
        == normalize(expected_subcategory)
    )

    department_ok = (
        normalize(actual_department)
        == normalize(expected_department)
    )

    escalation_ok = (
        as_bool(actual_escalation)
        == as_bool(expected_escalation)
    )


    # ========================================================
    # COUNT
    # ========================================================

    if category_ok:
        category_correct += 1

    if subcategory_ok:
        subcategory_correct += 1

    if department_ok:
        department_correct += 1

    if escalation_ok:
        escalation_correct += 1


    # ========================================================
    # PRINT FAILURE
    # ========================================================

    if not (
        category_ok
        and subcategory_ok
        and department_ok
        and escalation_ok
    ):

        print(f"\n[FAIL] Test #{index}")

        print(f"Complaint: {complaint}")

        print("\nExpected:")
        print(f"  Category:     {expected_category}")
        print(f"  Subcategory:  {expected_subcategory}")
        print(f"  Department:   {expected_department}")
        print(f"  Escalation:   {expected_escalation}")

        print("\nActual:")
        print(f"  Category:     {actual_category}")
        print(f"  Subcategory:  {actual_subcategory}")
        print(f"  Department:   {actual_department}")
        print(f"  Escalation:   {actual_escalation}")

        print("\nFull local result:")
        print(result)

        failures.append({
            "test": index,
            "complaint": complaint,
            "expected_category": expected_category,
            "actual_category": actual_category,
            "expected_subcategory": expected_subcategory,
            "actual_subcategory": actual_subcategory,
            "expected_department": expected_department,
            "actual_department": actual_department,
            "expected_escalation": expected_escalation,
            "actual_escalation": actual_escalation
        })


# ============================================================
# ACCURACY
# ============================================================

total = len(tests)


def accuracy(correct):
    if total == 0:
        return 0

    return (correct / total) * 100


print("\n")
print("=" * 70)
print("LOCAL RULE ENGINE RESULTS")
print("=" * 70)

print(f"\nTotal complaints: {total}")

print(
    f"\nCategory:"
    f"\n  Correct:  {category_correct}/{total}"
    f"\n  Accuracy: {accuracy(category_correct):.2f}%"
)

print(
    f"\nSubcategory:"
    f"\n  Correct:  {subcategory_correct}/{total}"
    f"\n  Accuracy: {accuracy(subcategory_correct):.2f}%"
)

print(
    f"\nDepartment:"
    f"\n  Correct:  {department_correct}/{total}"
    f"\n  Accuracy: {accuracy(department_correct):.2f}%"
)

print(
    f"\nEscalation:"
    f"\n  Correct:  {escalation_correct}/{total}"
    f"\n  Accuracy: {accuracy(escalation_correct):.2f}%"
)


# ============================================================
# OVERALL
# ============================================================

total_checks = total * 4

total_correct = (
    category_correct
    + subcategory_correct
    + department_correct
    + escalation_correct
)

overall_accuracy = (
    total_correct / total_checks * 100
    if total_checks
    else 0
)


print("\n" + "=" * 70)
print("OVERALL LOCAL ACCURACY")
print("=" * 70)

print(
    f"\nCorrect checks: {total_correct}/{total_checks}"
)

print(
    f"Overall accuracy: {overall_accuracy:.2f}%"
)

print(
    f"\nFailed test cases: {len(failures)}"
)

print("\n" + "=" * 70)