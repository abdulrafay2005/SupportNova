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
print("SUPPORTNOVA MULTI-ISSUE COMPLAINT TEST")
print("=" * 70)


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


# Rows 301-325 are the 25 multi-issue complaints
multi_issue_ids = [
    f"CMP-{number:04d}"
    for number in range(301, 326)
]


multi_issue = df[
    df["Complaint_ID"].isin(multi_issue_ids)
].copy()


print("\n1. Dataset check")

print(
    "Expected multi-issue complaints:",
    len(multi_issue_ids)
)

print(
    "Found multi-issue complaints:",
    len(multi_issue)
)


if len(multi_issue) != 25:
    print("\nFAIL: Expected exactly 25 multi-issue complaints.")
    sys.exit(1)


print("PASS: All 25 multi-issue complaints found.")


print("\n2. Running deterministic multi-issue checks...")


results = []
all_passed = True


for _, row in multi_issue.iterrows():

    complaint_id = row["Complaint_ID"]
    complaint_text = row["Complaint_Text"]

    try:

        result = analyze_complaint({
            "text": complaint_text
        })


        escalation_ids = set(
            result["escalation"]["rule_ids"]
        )


        routing = result["routing"]


        primary_department = routing[
            "primary_department"
        ]

        supporting_departments = routing[
            "supporting_departments"
        ]


        has_multi_issue_escalation = (
            "ESC16" in escalation_ids
        )


        has_supporting_department = (
            len(supporting_departments) > 0
        )


        passed = (
            has_multi_issue_escalation
            and has_supporting_department
            and result["escalation"]["required"]
        )


        results.append({
            "Complaint_ID": complaint_id,
            "Category": result["classification"]["category"],
            "Subcategory": result["classification"]["subcategory"],
            "Primary_Department": primary_department,
            "Supporting_Departments": ", ".join(
                supporting_departments
            ),
            "ESC16": has_multi_issue_escalation,
            "Escalation": result["escalation"]["required"],
            "Priority": result["priority"],
            "Passed": passed
        })


        if passed:

            print(
                f"PASS: {complaint_id} "
                f"| Primary={primary_department} "
                f"| Supporting={supporting_departments} "
                f"| ESC16=True "
                f"| Priority={result['priority']}"
            )

        else:

            print(
                f"FAIL: {complaint_id}"
            )

            print(
                "  Classification:",
                result["classification"]
            )

            print(
                "  Routing:",
                routing
            )

            print(
                "  Escalation rules:",
                sorted(escalation_ids)
            )

            all_passed = False


    except Exception as error:

        print(
            f"FAIL: {complaint_id} "
            f"| Engine error: {error}"
        )

        all_passed = False


results_df = pd.DataFrame(results)


print("\n3. Multi-issue test summary")


if len(results_df) > 0:

    print(
        "ESC16 detected:",
        int(results_df["ESC16"].sum()),
        "/",
        len(results_df)
    )

    print(
        "Supporting department detected:",
        int(
            results_df[
                "Supporting_Departments"
            ].ne("").sum()
        ),
        "/",
        len(results_df)
    )

    print(
        "Escalated:",
        int(results_df["Escalation"].sum()),
        "/",
        len(results_df)
    )

    print(
        "Passed:",
        int(results_df["Passed"].sum()),
        "/",
        len(results_df)
    )


report_path = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    ),
    "reports",
    "multi_issue_test.csv"
)


os.makedirs(
    os.path.dirname(report_path),
    exist_ok=True
)


results_df.to_csv(
    report_path,
    index=False
)


print("\nReport saved to:")
print(report_path)


print("\n" + "=" * 70)


if all_passed:

    print("ALL MULTI-ISSUE TESTS PASSED")

else:

    print("MULTI-ISSUE TEST FAILED")


print("=" * 70)


if not all_passed:
    sys.exit(1)