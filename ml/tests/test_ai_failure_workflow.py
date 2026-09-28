import sys
import os

sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

# This test verifies the AI-failure fallback path, which only runs
# when the AI layer is engaged. `generate_ai_fields` is mocked below
# to raise, so NO real OpenAI request is ever made: enabling the flag
# here only forces `analyze_with_ai` to take the try/except fallback
# branch. Production behaviour is unaffected (the flag is set only in
# this test process).
os.environ["OPENAI_ENABLED"] = "true"
os.environ.setdefault("OPENAI_API_KEY", "test-only-unused")

import genai
from rule_engine import analyze_complaint


print("=" * 70)
print("SUPPORTNOVA AI FAILURE WORKFLOW TEST")
print("=" * 70)


complaint = (
    "My refund has not arrived yet."
)


# ============================================================
# 1. DETERMINISTIC ENGINE
# ============================================================

print()
print("1. Running deterministic rule engine...")

result = analyze_complaint(
    complaint
)

print("Rule engine completed.")


# ============================================================
# 2. SAVE TRUSTED FIELDS
# ============================================================

trusted_classification = result.get(
    "classification"
)

trusted_policies = result.get(
    "policies"
)

trusted_resolution = result.get(
    "actions",
    {}
).get(
    "resolution",
    []
)

trusted_escalation = result.get(
    "escalation",
    {}
)

trusted_routing = result.get(
    "routing"
)


# ============================================================
# 3. SIMULATE AI FAILURE
# ============================================================

print()
print("2. Simulating AI failure...")

original_generate_ai_fields = (
    genai.generate_ai_fields
)


def simulated_ai_failure(intelligence):
    raise RuntimeError(
        "SIMULATED_OPENAI_FAILURE"
    )


genai.generate_ai_fields = (
    simulated_ai_failure
)


# ============================================================
# 4. RUN COMPLETE AI PIPELINE
# ============================================================

print()
print("3. Running AI pipeline...")

try:

    final_result = genai.analyze_with_ai(
        result
    )

finally:

    # Restore the original function so this
    # test does not leave the imported module
    # in a modified state.
    genai.generate_ai_fields = (
        original_generate_ai_fields
    )


# ============================================================
# 5. VERIFY FALLBACK
# ============================================================

print()
print("4. Checking safe fallback...")


checks = [

    (
        "Fallback activated",
        final_result.get(
            "ai_guard",
            {}
        ).get(
            "blocked"
        ) is True
    ),

    (
        "Failure reason recorded",
        "SIMULATED_OPENAI_FAILURE"
        in final_result.get(
            "ai_guard",
            {}
        ).get(
            "reason",
            ""
        )
    ),

    (
        "Classification preserved",
        final_result.get(
            "classification"
        )
        == trusted_classification
    ),

    (
        "Policies preserved",
        final_result.get(
            "policies"
        )
        == trusted_policies
    ),

    (
        "Resolution preserved",
        final_result.get(
            "resolution",
            {}
        ).get(
            "steps"
        )
        == trusted_resolution
    ),

    (
        "Escalation preserved",
        final_result.get(
            "escalation",
            {}
        ).get(
            "required"
        )
        == trusted_escalation.get(
            "required"
        )
    ),

    (
        "Escalation level preserved",
        final_result.get(
            "escalation",
            {}
        ).get(
            "level"
        )
        == trusted_escalation.get(
            "highest_severity",
            "Standard"
        )
    ),

    (
        "Routing preserved",
        final_result.get(
            "routing"
        )
        == trusted_routing
    ),

    (
        "Safe customer response provided",
        bool(
            final_result.get(
                "customer_response",
                ""
            ).strip()
        )
    ),

    (
        "Agent guidance provided",
        bool(
            final_result.get(
                "agent_guidance",
                ""
            ).strip()
        )
    ),

    (
        "Follow-up required",
        final_result.get(
            "follow_up",
            {}
        ).get(
            "required"
        ) is True
    ),

    (
        "No unvalidated AI output returned",
        final_result.get(
            "sentiment",
            {}
        ).get(
            "label"
        ) == "neutral"
    ),
]


# ============================================================
# 6. PRINT RESULTS
# ============================================================

passed = 0


for name, condition in checks:

    if condition:

        print(
            f"[PASS] {name}"
        )

        passed += 1

    else:

        print(
            f"[FAIL] {name}"
        )


print()
print("=" * 70)

print(
    f"RESULT: {passed}/{len(checks)} PASSED"
)

print("=" * 70)


if passed != len(checks):

    raise SystemExit(1)


print()
print(
    "AI FAILURE WORKFLOW PASSED."
)

print(
    "Deterministic SupportNova data remained authoritative."
)