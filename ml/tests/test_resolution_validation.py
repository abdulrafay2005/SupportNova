import sys
import os

sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

from rule_engine import analyze_complaint

CASES = [
    {
        "name": "Refund request",
        "text": "I want a refund for my order NM-100500 because the product was defective.",
        "expected_subcategories": [
            "Defective product",
            "Refund delayed",
        ],
        "expected_policy": "POL16",
    },
    {
        "name": "Replacement request",
        "text": "The item in order NM-100501 arrived damaged. I want a replacement.",
        "expected_subcategories": [
            "Damaged parcel",
        ],
        "expected_policy": "POL09",
    },
    {
        "name": "Compensation request",
        "text": "My order NM-100502 arrived very late and I want compensation.",
        "expected_subcategories": [
            "Late delivery",
        ],
        "expected_policy": "POL07",
    },
    {
        "name": "Unsupported promise",
        "text": "Please guarantee that my refund will arrive tomorrow.",
        "expected_subcategories": [
            "Refund delayed",
        ],
        "expected_policy": "POL12",
    },
]


print("=" * 70)
print("SUPPORTNOVA RESOLUTION VALIDATION TEST")
print("=" * 70)


passed = 0
failed = 0


for case in CASES:

    print()
    print("-" * 70)
    print(case["name"])
    print("-" * 70)

    result = analyze_complaint({
        "text": case["text"]
    })

    subcategory = result.get("classification", {}).get("subcategory")   

    policies = result.get("policies", [])

    policy_ids = [
        p.get("Policy_ID")
        for p in policies
    ]

    print("Complaint:", case["text"])
    print("Subcategory:", subcategory)
    print("Priority:", result.get("priority"))
    print("Missing information:", result.get("missing_information"))
    print("Policies:", policy_ids)
    print("Recommended actions:", result.get("recommended_actions"))
    print("Escalations:", result.get("escalations"))

    subcategory_ok = (
        subcategory in case["expected_subcategories"]
    )

    policy_ok = (
        case["expected_policy"] in policy_ids
    )

    if subcategory_ok and policy_ok:
        print("[PASS]")
        passed += 1
    else:
        print("[FAIL]")

        if not subcategory_ok:
            print(
                "  Expected subcategory:",
                case["expected_subcategories"]
            )

        if not policy_ok:
            print(
                "  Expected policy:",
                case["expected_policy"]
            )

        failed += 1


print()
print("=" * 70)
print(f"RESULT: {passed}/{len(CASES)} PASSED")
print("=" * 70)

if failed:
    raise SystemExit(1)