from validator import validate_result


def run_test(name, engine_result, should_pass):
    result = validate_result(engine_result)

    passed = result.valid == should_pass

    if passed:
        print(f"[PASS] {name}")
    else:
        print(f"[FAIL] {name}")

        if result.errors:
            print("       Errors:")
            for error in result.errors:
                print(f"       - {error}")

    return passed


# ============================================================
# TEST CASES
# ============================================================

tests = [

    # --------------------------------------------------------
    # 1. Valid normal result
    # --------------------------------------------------------

    (
        "Valid duplicate charge result",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Duplicate charge",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-021"},
                {"rule_id": "RR-022"},
                {"rule_id": "RR-023"},
                {"rule_id": "RR-024"},
                {"rule_id": "RR-025"}
            ],
            "sla_hours": 24
        },
        True
    ),

    # --------------------------------------------------------
    # 2. Invalid category
    # --------------------------------------------------------

    (
        "Invalid category",
        {
            "classification": {
                "category": "Fake Category",
                "subcategory": "Duplicate charge",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-021"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 3. Category / subcategory mismatch
    # --------------------------------------------------------

    (
        "Category subcategory mismatch",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Late delivery",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 4. Invalid department
    # --------------------------------------------------------

    (
        "Invalid department",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Duplicate charge",
                "department": "Fake Department"
            },
            "routing": {
                "primary_department": "Fake Department"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-021"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 5. Invalid policy
    # --------------------------------------------------------

    (
        "Invalid policy",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Duplicate charge",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL999"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-021"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 6. Wrong resolution rule
    # --------------------------------------------------------

    (
        "Resolution rule belongs to wrong subcategory",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Duplicate charge",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-001"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 7. Critical escalation with Standard priority
    # --------------------------------------------------------

    (
        "Critical escalation cannot have Standard priority",
        {
            "classification": {
                "category": "Account & Security",
                "subcategory": "Account takeover concern",
                "department": "Account Security"
            },
            "routing": {
                "primary_department": "Account Security"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": ["ESC01"]
            },
            "policies": [
                {"policy_id": "POL15"},
                {"policy_id": "POL22"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-071"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 8. Critical escalation routed incorrectly
    # --------------------------------------------------------

    (
        "Critical escalation routed to wrong department",
        {
            "classification": {
                "category": "Account & Security",
                "subcategory": "Account takeover concern",
                "department": "Account Security"
            },
            "routing": {
                "primary_department": "Customer Support"
            },
            "priority": "Critical",
            "escalation": {
                "rule_ids": ["ESC01"]
            },
            "policies": [
                {"policy_id": "POL15"},
                {"policy_id": "POL22"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-071"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 9. Invalid escalation
    # --------------------------------------------------------

    (
        "Invalid escalation ID",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Duplicate charge",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "High",
            "escalation": {
                "rule_ids": ["ESC999"]
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-021"}
            ],
            "sla_hours": 24
        },
        False
    ),

    # --------------------------------------------------------
    # 10. Invalid SLA
    # --------------------------------------------------------

    (
        "Invalid SLA",
        {
            "classification": {
                "category": "Payments & Billing",
                "subcategory": "Duplicate charge",
                "department": "Payments & Finance"
            },
            "routing": {
                "primary_department": "Payments & Finance"
            },
            "priority": "Standard",
            "escalation": {
                "rule_ids": []
            },
            "policies": [
                {"policy_id": "POL05"}
            ],
            "resolution_rules": [
                {"rule_id": "RR-021"}
            ],
            "sla_hours": -5
        },
        False
    ),

]


# ============================================================
# RUN TESTS
# ============================================================

print("\n" + "=" * 70)
print("SUPPORTNOVA VALIDATOR TESTS")
print("=" * 70)

passed = 0
failed = 0

for name, engine_result, should_pass in tests:

    if run_test(
        name,
        engine_result,
        should_pass
    ):
        passed += 1
    else:
        failed += 1


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("TEST SUMMARY")
print("=" * 70)

print(f"Passed: {passed}/{len(tests)}")
print(f"Failed: {failed}/{len(tests)}")

if failed == 0:
    print("\nALL VALIDATOR TESTS PASSED.")
else:
    print("\nSOME VALIDATOR TESTS FAILED.")