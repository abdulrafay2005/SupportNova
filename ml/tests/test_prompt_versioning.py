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


from prompt_manager import (
    get_prompt_version,
    get_prompt_metadata,
    build_prompt,
    PROMPT_REGISTRY
)

import genai
from rule_engine import analyze_complaint


print("=" * 70)
print("SUPPORTNOVA PROMPT VERSIONING TEST")
print("=" * 70)


# ============================================================
# 1. DEFAULT VERSION
# ============================================================

print()
print("1. Checking default prompt version...")

old_version = os.environ.get(
    "SUPPORTNOVA_PROMPT_VERSION"
)

os.environ.pop(
    "SUPPORTNOVA_PROMPT_VERSION",
    None
)

version = get_prompt_version()

if version == "1.0.0":
    print("[PASS] Default prompt version is 1.0.0")
else:
    print(
        "[FAIL] Unexpected default version:",
        version
    )
    raise SystemExit(1)


# ============================================================
# 2. PROMPT REGISTRY
# ============================================================

print()
print("2. Checking prompt registry...")

if (
    "complaint_analysis"
    in PROMPT_REGISTRY
    and
    "1.0.0"
    in PROMPT_REGISTRY["complaint_analysis"]
):
    print("[PASS] Complaint analysis v1.0.0 registered")
else:
    print("[FAIL] Prompt version not registered")
    raise SystemExit(1)


# ============================================================
# 3. PROMPT METADATA
# ============================================================

print()
print("3. Checking prompt metadata...")

metadata = get_prompt_metadata()

checks = [
    (
        "Prompt name",
        metadata.get("prompt_name")
        == "complaint_analysis"
    ),

    (
        "Prompt version",
        metadata.get("version")
        == "1.0.0"
    ),

    (
        "Module version",
        metadata.get("prompt_version")
        == "1.0.0"
    )
]


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


# ============================================================
# 4. BUILD VERSIONED PROMPT
# ============================================================

print()
print("4. Checking versioned prompt generation...")

trusted_data = json.dumps(
    {
        "classification": {
            "category": "Payments & Billing",
            "subcategory": "Refund delayed",
            "department": "Payments & Finance"
        }
    },
    indent=2
)

prompt = build_prompt(
    trusted_data
)


prompt_checks = [

    (
        "Prompt generated",
        isinstance(prompt, str)
        and len(prompt) > 100
    ),

    (
        "Authority model present",
        "deterministic SupportNova rule engine is authoritative"
        in prompt
    ),

    (
        "Hallucination rules present",
        "Never invent facts."
        in prompt
    ),

    (
        "Prompt injection protection present",
        "PROMPT INJECTION PROTECTION"
        in prompt
    ),

    (
        "JSON output requirement present",
        "Return ONLY valid JSON."
        in prompt
    )
]


for name, condition in prompt_checks:

    if condition:
        print(
            f"[PASS] {name}"
        )
        passed += 1
    else:
        print(
            f"[FAIL] {name}"
        )


# ============================================================
# 5. ENVIRONMENT VERSION SELECTION
# ============================================================

print()
print("5. Checking configurable prompt version...")

os.environ[
    "SUPPORTNOVA_PROMPT_VERSION"
] = "1.0.0"

if get_prompt_version() == "1.0.0":
    print(
        "[PASS] Environment prompt version accepted"
    )
    passed += 1
else:
    print(
        "[FAIL] Environment prompt version not accepted"
    )


# ============================================================
# 6. INVALID VERSION PROTECTION
# ============================================================

print()
print("6. Checking invalid prompt version protection...")

os.environ[
    "SUPPORTNOVA_PROMPT_VERSION"
] = "999.0.0"

try:

    get_prompt_metadata()

    print(
        "[FAIL] Unsupported prompt version was accepted"
    )

except ValueError:

    print(
        "[PASS] Unsupported prompt version rejected"
    )

    passed += 1


# Restore environment
if old_version is None:

    os.environ.pop(
        "SUPPORTNOVA_PROMPT_VERSION",
        None
    )

else:

    os.environ[
        "SUPPORTNOVA_PROMPT_VERSION"
    ] = old_version


# ============================================================
# 7. GENAI INTEGRATION
# ============================================================

print()
print("7. Checking GenAI integration...")

complaint = (
    "My refund has not arrived yet."
)

result = analyze_complaint(
    complaint
)

intelligence = genai.create_intelligence(
    result
)

if (
    intelligence.get("prompt", {}).get("name")
    == "complaint_analysis"
    and
    intelligence.get("prompt", {}).get("version")
    == "1.0.0"
):

    print(
        "[PASS] GenAI result records prompt version"
    )

    passed += 1

else:

    print(
        "[FAIL] GenAI result does not record prompt version"
    )


# ============================================================
# SUMMARY
# ============================================================

total = (
    len(checks)
    + len(prompt_checks)
    + 1
    + 1
    + 1
)

print()
print("=" * 70)

print(
    f"RESULT: {passed}/{total} PASSED"
)

print("=" * 70)


if passed != total:

    raise SystemExit(1)


print()
print(
    "PROMPT VERSIONING PASSED."
)

print(
    "Prompts are centralized, versioned, configurable, "
    "and integrated with the GenAI pipeline."
)