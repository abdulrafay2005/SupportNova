import os
import sys
import pandas as pd

# Allow importing rule_engine from project root
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.rule_engine import analyze_complaint


DATA_PATH = os.path.join(
    PROJECT_ROOT,
    "ml",
    "data",
    "complaints.csv"
)

REPORT_PATH = os.path.join(
    PROJECT_ROOT,
    "ml",
    "reports",
    "contradictory_policy_test.csv"
)


EXPECTED_IDS = [
    f"CMP-{i:04d}"
    for i in range(326, 346)
]


def main():

    print("=" * 70)
    print("SUPPORTNOVA CONTRADICTORY / DIFFICULT POLICY TEST")
    print("=" * 70)

    # --------------------------------------------------------
    # 1. Dataset check
    # --------------------------------------------------------

    print("\n1. Dataset check")

    df = pd.read_csv(DATA_PATH)

    test_df = df[
        df["Complaint_ID"].isin(EXPECTED_IDS)
    ].copy()

    print(
        f"Expected contradictory complaints: {len(EXPECTED_IDS)}"
    )

    print(
        f"Found contradictory complaints: {len(test_df)}"
    )

    missing_ids = [
        complaint_id
        for complaint_id in EXPECTED_IDS
        if complaint_id not in set(test_df["Complaint_ID"])
    ]

    if missing_ids:

        print(
            "FAIL: Missing complaint IDs:"
        )

        for complaint_id in missing_ids:
            print(f"  - {complaint_id}")

        raise SystemExit(1)

    print(
        "PASS: All 20 contradictory/difficult complaints found."
    )

    # --------------------------------------------------------
    # 2. Deterministic policy checks
    # --------------------------------------------------------

    print(
        "\n2. Running deterministic contradiction checks..."
    )

    results = []

    for _, row in test_df.iterrows():

        complaint_id = row["Complaint_ID"]
        text = str(row["Complaint_Text"])

        passed = True

        errors = []

        try:

            result = analyze_complaint(
                {
                    "complaint_id": complaint_id,
                    "text": text,
                    "order_status": "Delivered",
                    "final_sale": True,
                    "refund_overdue": False
                }
            )

            escalation_ids = {
                rule["Escalation_ID"]
                for rule in result["escalation"]["rules"]
            }

            policies = result.get(
                "policies",
                []
            )

            policy_ids = {
                policy.get("Policy_ID")
                for policy in policies
                if policy.get("Policy_ID")
            }

            # ------------------------------------------------
            # Required contradiction behavior
            # ------------------------------------------------

            # ESC13:
            # Delivered but not received
            if "ESC13" not in escalation_ids:

                passed = False

                errors.append(
                    "ESC13 missing"
                )

            # ESC14:
            # Damage + final-sale conflict
            if "ESC14" not in escalation_ids:

                passed = False

                errors.append(
                    "ESC14 missing"
                )

            # Policy conflict should be represented
            # by the deterministic engine.
            if "POL10" not in policy_ids:

                passed = False

                errors.append(
                    "POL10 missing"
                )

            # Contradictory cases must require escalation.
            if not result["escalation"]["required"]:

                passed = False

                errors.append(
                    "Escalation not required"
                )

            # Priority should be High because ESC13/ESC14
            # are High severity rules.
            if result["priority"] != "High":

                passed = False

                errors.append(
                    f"Expected High priority, got {result['priority']}"
                )

            # ------------------------------------------------
            # Routing must not disappear
            # ------------------------------------------------

            routing = result.get(
                "routing",
                {}
            )

            primary_department = routing.get(
                "primary_department"
            )

            supporting_departments = routing.get(
                "supporting_departments",
                []
            )

            if not primary_department:

                passed = False

                errors.append(
                    "Missing primary department"
                )

            # ------------------------------------------------
            # The contradiction should produce multiple
            # departments somewhere in the workflow.
            # ------------------------------------------------

            routed_departments = set()

            if primary_department:
                routed_departments.add(
                    primary_department
                )

            routed_departments.update(
                supporting_departments
            )

            if len(routed_departments) < 2:

                passed = False

                errors.append(
                    "Expected multi-department handling"
                )

            results.append(
                {
                    "Complaint_ID": complaint_id,
                    "Primary_Department": primary_department,
                    "Supporting_Departments": ", ".join(
                        supporting_departments
                    ),
                    "Escalation_IDs": ", ".join(
                        sorted(escalation_ids)
                    ),
                    "Policy_IDs": ", ".join(
                        sorted(policy_ids)
                    ),
                    "Priority": result["priority"],
                    "Escalation_Required": result[
                        "escalation"
                    ]["required"],
                    "Passed": passed,
                    "Errors": "; ".join(errors)
                }
            )

            if passed:

                print(
                    f"PASS: {complaint_id} | "
                    f"Primary={primary_department} | "
                    f"Supporting={supporting_departments} | "
                    f"ESC13={'ESC13' in escalation_ids} | "
                    f"ESC14={'ESC14' in escalation_ids} | "
                    f"Priority={result['priority']}"
                )

            else:

                print(
                    f"FAIL: {complaint_id} | "
                    f"{'; '.join(errors)}"
                )

        except Exception as exc:

            results.append(
                {
                    "Complaint_ID": complaint_id,
                    "Primary_Department": "",
                    "Supporting_Departments": "",
                    "Escalation_IDs": "",
                    "Policy_IDs": "",
                    "Priority": "",
                    "Escalation_Required": False,
                    "Passed": False,
                    "Errors": f"Engine error: {exc}"
                }
            )

            print(
                f"FAIL: {complaint_id} | "
                f"Engine error: {exc}"
            )

    # --------------------------------------------------------
    # 3. Summary
    # --------------------------------------------------------

    report = pd.DataFrame(results)

    os.makedirs(
        os.path.dirname(REPORT_PATH),
        exist_ok=True
    )

    report.to_csv(
        REPORT_PATH,
        index=False
    )

    total = len(report)

    esc13_count = sum(
        "ESC13" in str(value)
        for value in report["Escalation_IDs"]
    )

    esc14_count = sum(
        "ESC14" in str(value)
        for value in report["Escalation_IDs"]
    )

    escalation_count = int(
        report["Escalation_Required"].sum()
    )

    passed_count = int(
        report["Passed"].sum()
    )

    print("\n3. Contradictory policy test summary")

    print(
        f"ESC13 detected: {esc13_count} / {total}"
    )

    print(
        f"ESC14 detected: {esc14_count} / {total}"
    )

    print(
        f"Escalated: {escalation_count} / {total}"
    )

    print(
        f"Passed: {passed_count} / {total}"
    )

    print("\nReport saved to:")

    print(REPORT_PATH)

    if passed_count == total:

        print(
            "\nALL CONTRADICTORY POLICY TESTS PASSED"
        )

    else:

        print(
            "\nCONTRADICTORY POLICY TESTS FAILED"
        )

        raise SystemExit(1)


if __name__ == "__main__":
    main()