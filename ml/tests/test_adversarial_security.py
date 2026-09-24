import sys
import os
import pandas as pd

sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

from rule_engine import analyze_complaint


print("=" * 70)
print("SUPPORTNOVA ADVERSARIAL SECURITY TEST")
print("=" * 70)


# ---------------------------------------------------------
# 1. Load the real dataset
# ---------------------------------------------------------

dataset_path = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    ),
    "data",
    "complaints.csv"
)

df = pd.read_csv(dataset_path)


# ---------------------------------------------------------
# 2. Select the 20 actual prompt-injection complaints
# ---------------------------------------------------------

adversarial_ids = [
    f"CMP-{number:04d}"
    for number in range(351, 371)
]

adversarial = df[
    df["Complaint_ID"].isin(adversarial_ids)
].copy()


print("\n1. Dataset check")

print(
    "Expected adversarial complaints:",
    len(adversarial_ids)
)

print(
    "Found adversarial complaints:",
    len(adversarial)
)


if len(adversarial) != 20:

    print(
        "\nFAIL: Expected exactly 20 adversarial complaints."
    )

    sys.exit(1)

print("PASS: All 20 adversarial complaints found.")


# ---------------------------------------------------------
# 3. Test every adversarial complaint
# ---------------------------------------------------------

print("\n2. Running deterministic security checks...")

all_passed = True

results = []


for _, row in adversarial.iterrows():

    complaint_id = row["Complaint_ID"]
    complaint_text = row["Complaint_Text"]

    try:

        result = analyze_complaint({
            "text": complaint_text
        })

        escalation_ids = set(
            result["escalation"]["rule_ids"]
        )

        # These two security rules should be triggered
        # by the attack text:
        #
        # ESC11 = Prompt injection attempt
        # ESC02 = Possible personal-data exposure

        has_prompt_injection = "ESC11" in escalation_ids

        has_data_exposure = "ESC02" in escalation_ids

        security_flagged = result["security"]["flagged"]

        prompt_injection_flagged = (
            result["security"]["prompt_injection"]
        )

        secret_request_flagged = (
            result["security"]["secret_request"]
        )

        passed = (
            has_prompt_injection
            and has_data_exposure
            and security_flagged
            and prompt_injection_flagged
        )

        results.append({
            "Complaint_ID": complaint_id,
            "ESC11": has_prompt_injection,
            "ESC02": has_data_exposure,
            "Security_Flagged": security_flagged,
            "Prompt_Injection": prompt_injection_flagged,
            "Secret_Request": secret_request_flagged,
            "Priority": result["priority"],
            "Escalation": result["escalation"]["required"],
            "Passed": passed
        })

        if passed:

            print(
                f"PASS: {complaint_id} "
                f"| ESC11={has_prompt_injection} "
                f"| ESC02={has_data_exposure} "
                f"| Security={security_flagged} "
                f"| Priority={result['priority']}"
            )

        else:

            print(
                f"FAIL: {complaint_id}"
            )

            print(
                "  Escalation rules:",
                sorted(escalation_ids)
            )

            print(
                "  Security flagged:",
                security_flagged
            )

            all_passed = False

    except Exception as error:

        print(
            f"FAIL: {complaint_id} "
            f"| Engine error: {error}"
        )

        all_passed = False


# ---------------------------------------------------------
# 4. Summary
# ---------------------------------------------------------

results_df = pd.DataFrame(results)


print("\n3. Security test summary")

if len(results_df) > 0:

    print(
        "ESC11 detected:",
        int(results_df["ESC11"].sum()),
        "/",
        len(results_df)
    )

    print(
        "ESC02 detected:",
        int(results_df["ESC02"].sum()),
        "/",
        len(results_df)
    )

    print(
        "Security flagged:",
        int(results_df["Security_Flagged"].sum()),
        "/",
        len(results_df)
    )

    print(
        "Prompt injection flagged:",
        int(results_df["Prompt_Injection"].sum()),
        "/",
        len(results_df)
    )

    print(
        "Passed:",
        int(results_df["Passed"].sum()),
        "/",
        len(results_df)
    )


# ---------------------------------------------------------
# 5. Save evidence
# ---------------------------------------------------------

report_path = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    ),
    "reports",
    "adversarial_security_test.csv"
)

os.makedirs(
    os.path.dirname(report_path),
    exist_ok=True
)

results_df.to_csv(
    report_path,
    index=False
)


print(
    "\nSecurity test report saved to:"
)

print(report_path)


# ---------------------------------------------------------
# 6. Final result
# ---------------------------------------------------------

print("\n" + "=" * 70)

if all_passed:

    print(
        "ALL ADVERSARIAL SECURITY TESTS PASSED"
    )

else:

    print(
        "ADVERSARIAL SECURITY TEST FAILED"
    )

print("=" * 70)


if not all_passed:

    sys.exit(1)