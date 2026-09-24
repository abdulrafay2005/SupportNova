import sys
import os
import json


sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)


from rule_engine import analyze_complaint
from genai import analyze_with_ai


complaint = {
    "text": (
        "I was charged twice for the same order "
        "and want one payment refunded."
    )
}


print("=" * 70)
print("SUPPORTNOVA OPENAI GENAI PIPELINE TEST")
print("=" * 70)


print("\n1. Running deterministic rule engine...")

result = analyze_complaint(
    complaint
)


print("Rule engine completed.")


print("\n2. Trusted deterministic classification:")

print(
    "Category:",
    result["classification"]["category"]
)

print(
    "Subcategory:",
    result["classification"]["subcategory"]
)

print(
    "Department:",
    result["classification"]["department"]
)

print(
    "Priority:",
    result["priority"]
)

print(
    "SLA:",
    result["sla_hours"],
    "hours"
)

print(
    "Escalation:",
    result["escalation"]["required"]
)


print("\n3. Sending trusted data to OpenAI...")


final_result = analyze_with_ai(
    result
)


print("\n4. FINAL SUPPORTNOVA RESULT")
print("=" * 70)


print(
    json.dumps(
        final_result,
        indent=2,
        ensure_ascii=False
    )
)


print("\n")
print("=" * 70)
print("TEST COMPLETED SUCCESSFULLY")
print("=" * 70)