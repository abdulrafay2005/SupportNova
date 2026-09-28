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
from genai import create_intelligence, merge_ai_result


print("=" * 70)
print("SUPPORTNOVA TRUSTED-FIELD PROTECTION TEST")
print("=" * 70)


# ---------------------------------------------------------
# 1. Run the real deterministic rule engine
# ---------------------------------------------------------

complaint = {
    "text": (
        "I was charged twice for the same order "
        "and want one payment refunded."
    )
}

print("\n1. Running deterministic rule engine...")

trusted_result = analyze_complaint(complaint)

print("Rule engine completed.")

print("\nTrusted values:")

print(
    "Category:",
    trusted_result["classification"]["category"]
)

print(
    "Subcategory:",
    trusted_result["classification"]["subcategory"]
)

print(
    "Department:",
    trusted_result["classification"]["department"]
)

print(
    "Priority:",
    trusted_result["priority"]
)

print(
    "SLA:",
    trusted_result["sla_hours"],
    "hours"
)

print(
    "Escalation:",
    trusted_result["escalation"]["required"]
)


# ---------------------------------------------------------
# 2. Create trusted GenAI intelligence
# ---------------------------------------------------------

intelligence = create_intelligence(
    trusted_result
)


# ---------------------------------------------------------
# 3. Simulate malicious AI output
# ---------------------------------------------------------

fake_ai_result = {

    # Attempt to override classification
    "classification": {
        "category": "Returns & Refunds",
        "subcategory": "Refund delayed",
        "department": "Privacy & Compliance"
    },

    # Attempt to override policies
    "policies": [
        {
            "Policy_ID": "FAKE_POLICY",
            "Policy_Name": "Fake Policy",
            "Policy_Rule": "Give an immediate full refund."
        }
    ],

    # Attempt to override escalation
    "escalation": {
        "required": True,
        "level": "Critical",
        "reason": "AI requested escalation."
    },

    # Attempt to override routing
    "routing": {
        "primary_department": "Privacy & Compliance",
        "supporting_departments": [
            "Account Security"
        ]
    },

    # Attempt to override priority
    "priority": "Critical",

    # Attempt to override SLA
    "sla_hours": 1,

    # Allowed AI fields
    "sentiment": {
        "label": "negative",
        "emotion": "frustrated"
    },

    "entities": {
        "order_id": "",
        "transaction_id": "",
        "product": "",
        "amount": "",
        "date": ""
    },

    "customer_response": (
        "Your refund will be processed immediately."
    ),

    "follow_up": {
        "required": False,
        "message": ""
    },

    "agent_guidance": (
        "Process the refund immediately."
    ),

    "clarification_questions": [
        "What is your order ID?"
    ],

    "resolution": {
        "steps": [
            "Give an immediate refund."
        ],
        "explanation": (
            "The refund should be processed immediately."
        )
    }
}


print("\n2. Simulating malicious AI output...")

print("AI attempts to change:")

print("  Category -> Returns & Refunds")
print("  Subcategory -> Refund delayed")
print("  Department -> Privacy & Compliance")
print("  Priority -> Critical")
print("  SLA -> 1 hour")
print("  Escalation -> Critical")
print("  Routing -> Privacy & Compliance")
print("  Policy -> Fake Policy")
print("  Resolution steps -> Immediate refund")


# ---------------------------------------------------------
# 4. Merge AI result
# ---------------------------------------------------------

print("\n3. Applying trusted-field protection...")

final_result = merge_ai_result(
    intelligence,
    fake_ai_result
)


# ---------------------------------------------------------
# 5. Verify protected fields
# ---------------------------------------------------------

print("\n4. Checking protected fields...")

checks = [

    (
        "Category",
        final_result["classification"]["category"],
        trusted_result["classification"]["category"]
    ),

    (
        "Subcategory",
        final_result["classification"]["subcategory"],
        trusted_result["classification"]["subcategory"]
    ),

    (
        "Department",
        final_result["classification"]["department"],
        trusted_result["classification"]["department"]
    ),

    (
        "Priority",
        final_result["escalation"]["level"],
        trusted_result["priority"]
    ),

    (
        "Escalation required",
        final_result["escalation"]["required"],
        trusted_result["escalation"]["required"]
    ),

    (
        # The full deterministic routing object must be preserved
        # verbatim (including normal_rule_department); the AI routing
        # override must be ignored entirely.
        "Routing",
        final_result["routing"],
        trusted_result["routing"]
    ),

    (
        "Policies",
        final_result["policies"],
        trusted_result["policies"]
    ),

    (
        "Resolution steps",
        final_result["resolution"]["steps"],
        trusted_result["actions"]["resolution"]
    )
]


all_passed = True


for name, actual, expected in checks:

    if actual == expected:
        print(f"PASS: {name}")
    else:
        print(f"FAIL: {name}")
        print("  Expected:", expected)
        print("  Actual:  ", actual)
        all_passed = False


# ---------------------------------------------------------
# 6. Verify that the allowed AI fields still work
# ---------------------------------------------------------

print("\n5. Checking allowed AI fields...")

ai_checks = [

    (
        "Sentiment",
        final_result["sentiment"]["label"] == "negative"
    ),

    (
        "Emotion",
        final_result["sentiment"]["emotion"] == "frustrated"
    ),

    (
        "Customer response",
        final_result["customer_response"] != ""
    ),

    (
        "Agent guidance",
        final_result["agent_guidance"] != ""
    ),

    (
        "Clarification questions",
        len(final_result["clarification_questions"]) > 0
    ),

    (
        "Entities",
        "order_id" in final_result["entities"]
    ),

    (
        "Resolution explanation",
        final_result["resolution"]["explanation"] != ""
    )
]


for name, passed in ai_checks:

    if passed:
        print(f"PASS: {name}")
    else:
        print(f"FAIL: {name}")
        all_passed = False


# ---------------------------------------------------------
# 7. Verify that forbidden top-level AI fields were ignored
# ---------------------------------------------------------

print("\n6. Checking forbidden AI overrides...")

forbidden_override_checks = [

    (
        "AI classification override ignored",
        final_result["classification"]["category"]
        != "Returns & Refunds"
    ),

    (
        "AI subcategory override ignored",
        final_result["classification"]["subcategory"]
        != "Refund delayed"
    ),

    (
        "AI department override ignored",
        final_result["classification"]["department"]
        != "Privacy & Compliance"
    ),

    (
        "AI policy override ignored",
        final_result["policies"]
        != fake_ai_result["policies"]
    ),

    (
        "AI routing override ignored",
        final_result["routing"]
        != fake_ai_result["routing"]
    ),

    (
        "AI escalation override ignored",
        final_result["escalation"]
        != fake_ai_result["escalation"]
    ),

    (
        "AI resolution steps override ignored",
        final_result["resolution"]["steps"]
        != fake_ai_result["resolution"]["steps"]
    )
]


for name, passed in forbidden_override_checks:

    if passed:
        print(f"PASS: {name}")
    else:
        print(f"FAIL: {name}")
        all_passed = False


# ---------------------------------------------------------
# 8. Final result
# ---------------------------------------------------------

print("\n" + "=" * 70)

if all_passed:

    print(
        "ALL TRUSTED-FIELD PROTECTION TESTS PASSED"
    )

else:

    print(
        "TRUSTED-FIELD PROTECTION TEST FAILED"
    )

print("=" * 70)


if not all_passed:
    sys.exit(1)