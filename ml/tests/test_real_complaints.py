import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rule_engine import analyze_complaint


DATASET_PATH = Path("ml/data/complaints.csv")


def main():
    print("=" * 70)
    print("SUPPORTNOVA REAL COMPLAINT END-TO-END TEST")
    print("=" * 70)

    df = pd.read_csv(DATASET_PATH)

    print(f"\nLoaded complaints: {len(df)}")

    required_columns = [
        "Complaint_Text",
        "Category",
        "Subcategory",
        "Assigned_Department",
    ]

    missing = [col for col in required_columns if col not in df.columns]

    if missing:
        print("\n[FAIL] Missing required columns:")
        for col in missing:
            print(" -", col)
        return

    print("[PASS] Required columns found")

    results = []

    for index, row in df.iterrows():
        complaint_text = str(row["Complaint_Text"])

        try:
            result = analyze_complaint(complaint_text)

            classification = result.get("classification", {})

            predicted_category = classification.get("category")
            predicted_subcategory = classification.get("subcategory")
            predicted_department = result.get("classification", {}).get("department")

            expected_category = str(row["Category"])
            expected_subcategory = str(row["Subcategory"])
            expected_department = str(row["Assigned_Department"])

            results.append({
                "row": index + 1,
                "category_expected": expected_category,
                "category_predicted": predicted_category,
                "category_match": predicted_category == expected_category,
                "subcategory_expected": expected_subcategory,
                "subcategory_predicted": predicted_subcategory,
                "subcategory_match": predicted_subcategory == expected_subcategory,
                "department_expected": expected_department,
                "department_predicted": predicted_department,
                "department_match": predicted_department == expected_department,
            })

        except Exception as e:
            results.append({
                "row": index + 1,
                "category_expected": row["Category"],
                "category_predicted": "ERROR",
                "category_match": False,
                "subcategory_expected": row["Subcategory"],
                "subcategory_predicted": "ERROR",
                "subcategory_match": False,
                "department_expected": row["Assigned_Department"],
                "department_predicted": "ERROR",
                "department_match": False,
            })

            print(f"[ERROR] Complaint {index + 1}: {e}")

    results_df = pd.DataFrame(results)

    category_correct = results_df["category_match"].sum()
    subcategory_correct = results_df["subcategory_match"].sum()
    department_correct = results_df["department_match"].sum()

    total = len(results_df)

    category_accuracy = category_correct / total
    subcategory_accuracy = subcategory_correct / total
    department_accuracy = department_correct / total

    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)

    print(
        f"\nCategory:"
        f"       {category_correct}/{total}"
        f" ({category_accuracy * 100:.2f}%)"
    )

    print(
        f"Subcategory:"
        f"    {subcategory_correct}/{total}"
        f" ({subcategory_accuracy * 100:.2f}%)"
    )

    print(
        f"Department:"
        f"      {department_correct}/{total}"
        f" ({department_accuracy * 100:.2f}%)"
    )

    output_path = Path("ml/reports/real_complaint_test.csv")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    results_df.to_csv(output_path, index=False)

    print(f"\nDetailed results saved to: {output_path}")

    print("\n" + "=" * 70)
    print("MISMATCH SUMMARY")
    print("=" * 70)

    category_mismatches = results_df[
        ~results_df["category_match"]
    ]

    subcategory_mismatches = results_df[
        ~results_df["subcategory_match"]
    ]

    department_mismatches = results_df[
        ~results_df["department_match"]
    ]

    print("\nCategory mismatches:", len(category_mismatches))
    print("Subcategory mismatches:", len(subcategory_mismatches))
    print("Department mismatches:", len(department_mismatches))

    if len(category_mismatches) > 0:
        print("\nFirst 10 category mismatches:")

        print(
            category_mismatches[
                [
                    "row",
                    "category_expected",
                    "category_predicted",
                ]
            ].head(10).to_string(index=False)
        )

    if len(subcategory_mismatches) > 0:
        print("\nFirst 10 subcategory mismatches:")

        print(
            subcategory_mismatches[
                [
                    "row",
                    "subcategory_expected",
                    "subcategory_predicted",
                ]
            ].head(10).to_string(index=False)
        )

    if len(department_mismatches) > 0:
        print("\nFirst 10 department mismatches:")

        print(
            department_mismatches[
                [
                    "row",
                    "department_expected",
                    "department_predicted",
                ]
            ].head(10).to_string(index=False)
        )

    print("\n" + "=" * 70)
    print("REAL COMPLAINT TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()