import csv
import requests
from collections import Counter

# ============================================================
# CONFIG
# ============================================================

API_URL = "http://127.0.0.1:8000/api/complaints"

CSV_FILE = "ml/data/e2e_test.csv"

# Change these if your final API response uses different names.
INPUT_FIELD = "Complaint_Text"

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


def get_nested(data, *keys):
    """
    Safely find a value in a nested response.

    Example:
        get_nested(response, "classification", "category")
    """

    current = data

    for key in keys:
        if not isinstance(current, dict):
            return None

        current = current.get(key)

    return current


def find_value(data, possible_keys):
    """
    Search the API response recursively for one of the
    expected field names.
    """

    if isinstance(data, dict):

        for key in possible_keys:
            if key in data:
                return data[key]

        for value in data.values():
            result = find_value(value, possible_keys)

            if result is not None:
                return result

    elif isinstance(data, list):

        for item in data:
            result = find_value(item, possible_keys)

            if result is not None:
                return result

    return None


# ============================================================
# LOAD DATASET
# ============================================================

with open(CSV_FILE, "r", encoding="utf-8-sig", newline="") as file:
    reader = csv.DictReader(file)
    tests = list(reader)[:10]


print("=" * 70)
print("SUPPORTNOVA END-TO-END ACCURACY TEST")
print("=" * 70)

print(f"\nTest dataset: {CSV_FILE}")
print(f"Total test complaints: {len(tests)}")
print(f"API: {API_URL}\n")


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

    payload = {
        "title": "E2E Test Complaint",
        "description": complaint
    }

    try:

        response = requests.post(
            API_URL,
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            print(f"[ERROR] Test #{index}")
            print(f"        HTTP {response.status_code}")
            print(f"        Response: {response.text}")
            continue

        result = response.json()

    except Exception as error:

        failures.append({
            "test": index,
            "complaint": complaint,
            "error": str(error)
        })

        print(f"[ERROR] Test #{index}")
        print(f"        {error}")

        continue

      # --------------------------------------------------------
    # Extract actual values
    # --------------------------------------------------------

    actual_category = find_value(
        result,
        [
            "category",
            "Category"
        ]
    )

    actual_subcategory = find_value(
        result,
        [
            "subcategory",
            "sub_category",
            "subCategory",
            "Subcategory"
        ]
    )

    actual_department = find_value(
        result,
        [
            "department",
            "primary_department",
            "primaryDepartment",
            "Primary Department",
            "routing_department"
        ]
    )

    actual_escalation = find_value(
        result,
        [
            "is_escalated",
            "isEscalated"
        ]
    )

    if actual_escalation is None:
        escalation_obj = find_value(
            result,
            [
                "escalation",
                "Escalation"
            ]
        )

        if isinstance(escalation_obj, dict):
            actual_escalation = escalation_obj.get("required")
        else:
            actual_escalation = escalation_obj

    # --------------------------------------------------------
    # Compare
    # --------------------------------------------------------

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

    if category_ok:
        category_correct += 1

    if subcategory_ok:
        subcategory_correct += 1

    if department_ok:
        department_correct += 1

    if escalation_ok:
        escalation_correct += 1

    # --------------------------------------------------------
    # Print failures
    # --------------------------------------------------------

    if not (
        category_ok
        and subcategory_ok
        and department_ok
        and escalation_ok
    ):

        print(f"\n[FAIL] Test #{index}")

        print("Complaint:")
        print(f"  {complaint}")

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

        print()

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
print("END-TO-END RESULTS")
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
print("OVERALL PIPELINE ACCURACY")
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