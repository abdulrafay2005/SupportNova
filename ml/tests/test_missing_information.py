"""
SupportNova missing-information detection test (SRS #27).

This exercises the REAL deterministic rule engine (no mocks, no
OpenAI). It verifies that:

  * a complaint that lacks a required identifier is flagged with a
    non-empty `missing_information.fields` list, and
  * a complaint that supplies the identifier is NOT flagged.

Run from the repository root:

    PYTHONPATH=.:ml python ml/tests/test_missing_information.py
"""

import os
import sys

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

from rule_engine import analyze_complaint


CASES = [
    {
        "name": "Refund request without an order/transaction id",
        "input": {
            "text": (
                "I want a refund but I am not sure which order it "
                "was for."
            )
        },
        "expect_missing": True,
    },
    {
        "name": "Cancellation with a clear order id present",
        "input": {
            "text": "Please cancel order NM-100001, the air fryer.",
            "order_id": "NM-100001",
        },
        "expect_missing": False,
    },
]


def run():
    passed = 0

    for case in CASES:
        result = analyze_complaint(case["input"])
        missing = result.get("missing_information", {}) or {}
        fields = missing.get("fields", []) or []
        has_missing = bool(missing.get("required")) or bool(fields)

        ok = has_missing == case["expect_missing"]

        if ok:
            print(f"[PASS] {case['name']}  missing_fields={fields}")
            passed += 1
        else:
            print(
                f"[FAIL] {case['name']}  "
                f"expected_missing={case['expect_missing']} "
                f"got={has_missing} fields={fields}"
            )

    print("\n" + "=" * 60)
    print(f"RESULT: {passed}/{len(CASES)} PASSED")
    print("=" * 60)

    if passed != len(CASES):
        raise SystemExit(1)


if __name__ == "__main__":
    run()
