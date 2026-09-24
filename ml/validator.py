import pandas as pd
from pathlib import Path


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


# ============================================================
# LOAD GROUND-TRUTH DATA
# ============================================================

categories_df = pd.read_csv(DATA_DIR / "categories.csv")
subcategories_df = pd.read_csv(DATA_DIR / "subcategories.csv")
departments_df = pd.read_csv(DATA_DIR / "departments.csv")
policies_df = pd.read_csv(DATA_DIR / "policies_22.csv")
resolution_rules_df = pd.read_csv(DATA_DIR / "resolution_rules_110.csv")
escalation_rules_df = pd.read_csv(DATA_DIR / "escalation_rules_30.csv")


# ============================================================
# VALIDATION RESULT
# ============================================================

class ValidationResult:

    def __init__(self):
        self.errors = []
        self.warnings = []

    @property
    def valid(self):
        return len(self.errors) == 0

    def error(self, message):
        self.errors.append(message)

    def warning(self, message):
        self.warnings.append(message)

    def print_result(self):

        print("\n" + "=" * 70)
        print("SUPPORTNOVA GROUND-TRUTH VALIDATION")
        print("=" * 70)

        if self.valid:
            print("\nSTATUS: PASS")
            print("All validation checks passed.")
        else:
            print("\nSTATUS: FAIL")

            print("\nErrors:")
            for error in self.errors:
                print(" -", error)

        if self.warnings:
            print("\nWarnings:")
            for warning in self.warnings:
                print(" -", warning)

        print("\n" + "=" * 70)


# ============================================================
# HELPERS
# ============================================================

def clean(value):
    if value is None:
        return ""

    if pd.isna(value):
        return ""

    return str(value).strip()


def as_list(value):
    """
    Accept either:
        ["POL01", "POL02"]
    or:
        "POL01, POL02"
    """

    if value is None:
        return []

    if isinstance(value, list):
        return [clean(x) for x in value if clean(x)]

    value = clean(value)

    if not value:
        return []

    return [
        item.strip()
        for item in value.split(",")
        if item.strip()
    ]


# ============================================================
# VALIDATE CATEGORY
# ============================================================

def validate_category(result, category):

    valid_categories = set(
        categories_df["Category_Name"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    if not category:
        result.error("Category is missing.")
        return

    if category not in valid_categories:
        result.error(
            f"Invalid category: '{category}'"
        )


# ============================================================
# VALIDATE SUBCATEGORY
# ============================================================

def validate_subcategory(result, category, subcategory):

    valid_subcategories = set(
        subcategories_df["Subcategory_Name"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    if not subcategory:
        result.error("Subcategory is missing.")
        return

    if subcategory not in valid_subcategories:
        result.error(
            f"Invalid subcategory: '{subcategory}'"
        )
        return

    row = subcategories_df[
        subcategories_df["Subcategory_Name"].astype(str).str.strip()
        == subcategory
    ]

    if row.empty:
        result.error(
            f"Subcategory '{subcategory}' was not found."
        )
        return

    expected_category = clean(
        row.iloc[0]["Category_Name"]
    )

    if category and expected_category != category:
        result.error(
            f"Subcategory/category mismatch: "
            f"'{subcategory}' belongs to '{expected_category}', "
            f"not '{category}'."
        )


# ============================================================
# VALIDATE DEPARTMENT
# ============================================================

def validate_department(result, department):

    valid_departments = set(
        departments_df["Department_Name"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    if not department:
        result.error("Department is missing.")
        return

    if department not in valid_departments:
        result.error(
            f"Invalid department: '{department}'"
        )


# ============================================================
# VALIDATE POLICIES
# ============================================================

def validate_policies(result, policy_ids):

    policy_ids = as_list(policy_ids)

    valid_policy_ids = set(
        policies_df["Policy_ID"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    for policy_id in policy_ids:

        if policy_id not in valid_policy_ids:

            result.error(
                f"Invalid policy ID: '{policy_id}'"
            )

            continue

        row = policies_df[
            policies_df["Policy_ID"].astype(str).str.strip()
            == policy_id
        ]

        if row.empty:
            continue

        status = clean(row.iloc[0]["Status"])

        if status.lower() != "active":
            result.error(
                f"Policy '{policy_id}' is not Active. "
                f"Current status: '{status}'."
            )


# ============================================================
# VALIDATE RESOLUTION RULES
# ============================================================

def validate_resolution_rules(
    result,
    category,
    subcategory,
    rule_ids
):

    rule_ids = as_list(rule_ids)

    valid_rule_ids = set(
        resolution_rules_df["Rule_ID"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    for rule_id in rule_ids:

        if rule_id not in valid_rule_ids:

            result.error(
                f"Invalid resolution rule ID: '{rule_id}'"
            )

            continue

        row = resolution_rules_df[
            resolution_rules_df["Rule_ID"].astype(str).str.strip()
            == rule_id
        ]

        if row.empty:
            continue

        rule = row.iloc[0]

        rule_category = clean(rule["Category"])
        rule_subcategory = clean(rule["Subcategory"])

        if category and rule_category != category:

            result.error(
                f"Resolution rule '{rule_id}' belongs to "
                f"category '{rule_category}', not '{category}'."
            )

        if subcategory and rule_subcategory != subcategory:

            result.error(
                f"Resolution rule '{rule_id}' belongs to "
                f"subcategory '{rule_subcategory}', not "
                f"'{subcategory}'."
            )


# ============================================================
# VALIDATE ESCALATIONS
# ============================================================

def validate_escalations(
    result,
    escalation_ids
):

    escalation_ids = as_list(escalation_ids)

    valid_escalation_ids = set(
        escalation_rules_df["Escalation_ID"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    for escalation_id in escalation_ids:

        if escalation_id not in valid_escalation_ids:

            result.error(
                f"Invalid escalation ID: '{escalation_id}'"
            )


# ============================================================
# VALIDATE PRIORITY
# ============================================================

def validate_priority(
    result,
    priority,
    escalation_ids
):

    priority = clean(priority)

    valid_priorities = {
        "Standard",
        "Medium",
        "High",
        "Critical"
    }

    if priority not in valid_priorities:

        result.error(
            f"Invalid priority: '{priority}'"
        )

        return

    escalation_ids = as_list(escalation_ids)

    if not escalation_ids:
        return

    severity_rank = {
        "Standard": 0,
        "Medium": 1,
        "High": 2,
        "Critical": 3
    }

    highest_rank = 0
    highest_severity = "Standard"

    for escalation_id in escalation_ids:

        row = escalation_rules_df[
            escalation_rules_df["Escalation_ID"].astype(str).str.strip()
            == escalation_id
        ]

        if row.empty:
            continue

        severity = clean(row.iloc[0]["Severity"])

        rank = severity_rank.get(severity, 0)

        if rank > highest_rank:
            highest_rank = rank
            highest_severity = severity

    if severity_rank.get(priority, 0) < highest_rank:

        result.error(
            f"Priority '{priority}' is lower than the highest "
            f"escalation severity '{highest_severity}'."
        )


# ============================================================
# VALIDATE SLA
# ============================================================

def validate_sla(
    result,
    category,
    subcategory,
    sla_hours
):

    if sla_hours is None:
        result.error("SLA_Hours is missing.")
        return

    try:
        sla = float(sla_hours)
    except (TypeError, ValueError):

        result.error(
            f"Invalid SLA value: '{sla_hours}'"
        )

        return

    if sla <= 0:

        result.error(
            f"SLA must be greater than zero. "
            f"Received: {sla}"
        )

        return

    matching_rules = resolution_rules_df[
        (
            resolution_rules_df["Category"].astype(str).str.strip()
            == category
        )
        &
        (
            resolution_rules_df["Subcategory"].astype(str).str.strip()
            == subcategory
        )
    ]

    if matching_rules.empty:
        return

    valid_slas = set(
        pd.to_numeric(
            matching_rules["SLA_Hours"],
            errors="coerce"
        )
        .dropna()
        .tolist()
    )

    if sla not in valid_slas:

        result.error(
            f"SLA {sla} hours is not valid for "
            f"{subcategory}."
        )


# ============================================================
# VALIDATE ROUTING
# ============================================================

def validate_routing(
    result,
    routing_department,
    escalation_ids
):

    routing_department = clean(routing_department)

    if not routing_department:
        result.error("Routing department is missing.")
        return

    escalation_ids = as_list(escalation_ids)

    if not escalation_ids:
        return

    # Highest-severity escalation determines mandatory routing.
    severity_rank = {
        "Standard": 0,
        "Medium": 1,
        "High": 2,
        "Critical": 3
    }

    selected_department = None
    selected_rank = -1

    for escalation_id in escalation_ids:

        row = escalation_rules_df[
            escalation_rules_df["Escalation_ID"].astype(str).str.strip()
            == escalation_id
        ]

        if row.empty:
            continue

        escalation = row.iloc[0]

        severity = clean(escalation["Severity"])
        department = clean(escalation["Responsible_Department"])

        rank = severity_rank.get(severity, 0)

        if rank > selected_rank:
            selected_rank = rank
            selected_department = department

    if selected_department and routing_department != selected_department:

        result.error(
            f"Routing department '{routing_department}' does not "
            f"match mandatory escalation department "
            f"'{selected_department}'."
        )


# ============================================================
# MAIN VALIDATOR
# ============================================================

def validate_result(engine_result):

    result = ValidationResult()

    if not isinstance(engine_result, dict):

        result.error(
            "Engine result must be a dictionary."
        )

        return result

    # --------------------------------------------------------
    # Extract fields
    # --------------------------------------------------------

    classification = engine_result.get(
        "classification",
        {}
    )

    routing = engine_result.get(
        "routing",
        {}
    )

    escalation = engine_result.get(
        "escalation",
        {}
    )

    policies = engine_result.get(
        "policies",
        []
    )

    resolution_rules = engine_result.get(
        "resolution_rules",
        []
    )

    # --------------------------------------------------------
    # Classification
    # --------------------------------------------------------

    category = clean(
        classification.get("category")
    )

    subcategory = clean(
        classification.get("subcategory")
    )

    department = clean(
        classification.get("department")
    )

    validate_category(
        result,
        category
    )

    validate_subcategory(
        result,
        category,
        subcategory
    )

    validate_department(
        result,
        department
    )

    # --------------------------------------------------------
    # Routing
    # --------------------------------------------------------

    routing_department = clean(
        routing.get("primary_department")
    )

    escalation_ids = escalation.get(
        "rule_ids",
        []
    )

    priority = clean(
        engine_result.get("priority")
    )

    sla_hours = engine_result.get(
        "sla_hours"
    )

    # --------------------------------------------------------
    # Policies
    # --------------------------------------------------------

    policy_ids = []

    if isinstance(policies, list):

        for policy in policies:

            if isinstance(policy, dict):

                policy_id = policy.get(
                    "policy_id",
                    policy.get("Policy_ID", "")
                )

                policy_ids.append(policy_id)

            else:

                policy_ids.append(policy)

    validate_policies(
        result,
        policy_ids
    )

    # --------------------------------------------------------
    # Resolution rules
    # --------------------------------------------------------

    rule_ids = []

    if isinstance(resolution_rules, list):

        for rule in resolution_rules:

            if isinstance(rule, dict):

                rule_id = rule.get(
                    "rule_id",
                    rule.get("Rule_ID", "")
                )

                rule_ids.append(rule_id)

            else:

                rule_ids.append(rule)

    validate_resolution_rules(
        result,
        category,
        subcategory,
        rule_ids
    )

    # --------------------------------------------------------
    # Escalations
    # --------------------------------------------------------

    validate_escalations(
        result,
        escalation_ids
    )

    # --------------------------------------------------------
    # Priority
    # --------------------------------------------------------

    validate_priority(
        result,
        priority,
        escalation_ids
    )

    # --------------------------------------------------------
    # SLA
    # --------------------------------------------------------

    validate_sla(
        result,
        category,
        subcategory,
        sla_hours
    )

    # --------------------------------------------------------
    # Routing
    # --------------------------------------------------------

    validate_routing(
        result,
        routing_department,
        escalation_ids
    )

    return result


# ============================================================
# TEST MODE
# ============================================================

if __name__ == "__main__":

    print("SupportNova validator loaded successfully.")

    print("\nGround-truth data:")
    print(
        f"Categories:        {len(categories_df)}"
    )
    print(
        f"Subcategories:     {len(subcategories_df)}"
    )
    print(
        f"Departments:       {len(departments_df)}"
    )
    print(
        f"Policies:          {len(policies_df)}"
    )
    print(
        f"Resolution rules:  {len(resolution_rules_df)}"
    )
    print(
        f"Escalation rules:  {len(escalation_rules_df)}"
    )

    print("\nValidator ready.")