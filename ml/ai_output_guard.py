import re


REFUND_TERMS = [
    "refund",
    "reimbursement",
    "money back",
]

COMPENSATION_TERMS = [
    "compensation",
    "credit",
    "goodwill payment",
]

REPLACEMENT_TERMS = [
    "replacement",
    "replace the item",
    "send a replacement",
]

GUARANTEE_TERMS = [
    "guaranteed",
    "guarantee",
    "will definitely",
    "definitely receive",
    "certainly receive",
]

PROMISE_TERMS = [
    "will receive",
    "you will get",
    "we will issue",
    "we will provide",
    "will be issued",
]

APPROVAL_TERMS = [
    "approved",
    "has been approved",
    "was approved",
    "already approved",
]


def _contains_any(text, terms):
    text = str(text).lower()

    return any(
        term.lower() in text
        for term in terms
    )


def _all_ai_text(ai_data):
    parts = []

    for field in [
        "customer_response",
        "agent_guidance",
    ]:
        value = ai_data.get(field, "")

        if value:
            parts.append(str(value))

    follow_up = ai_data.get("follow_up", {})

    if isinstance(follow_up, dict):
        message = follow_up.get("message", "")

        if message:
            parts.append(str(message))

    resolution = ai_data.get("resolution", {})

    if isinstance(resolution, dict):
        explanation = resolution.get("explanation", "")

        if explanation:
            parts.append(str(explanation))

    return " ".join(parts)


def _extract_dates(text):
    patterns = [
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
        r"\b\d{4}-\d{1,2}-\d{1,2}\b",
        r"\b(?:today|tomorrow|yesterday)\b",
        r"\b(?:next|within)\s+\d+\s+(?:day|days|week|weeks)\b",
        r"\b(?:on|by)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    ]

    matches = []

    for pattern in patterns:
        matches.extend(
            re.findall(
                pattern,
                text,
                flags=re.IGNORECASE,
            )
        )

    return matches


def _extract_money(text):
    patterns = [
        r"(?:PKR|Rs\.?|USD|\$|€|£)\s?\d+(?:[.,]\d+)*",
        r"\b\d+(?:[.,]\d+)*\s?(?:PKR|USD|dollars?|rupees?)\b",
    ]

    matches = []

    for pattern in patterns:
        matches.extend(
            re.findall(
                pattern,
                text,
                flags=re.IGNORECASE,
            )
        )

    return matches


def _extract_order_ids(text):
    pattern = r"\b(?:ORD|ORDER)[-_ ]?[A-Z0-9]{3,}\b"

    return re.findall(
        pattern,
        text,
        flags=re.IGNORECASE,
    )


def _extract_transaction_ids(text):
    pattern = r"\b(?:TXN|TRANSACTION)[-_ ]?[A-Z0-9]{3,}\b"

    return re.findall(
        pattern,
        text,
        flags=re.IGNORECASE,
    )


def _extract_shipping_companies(text):
    companies = [
        "dhl",
        "fedex",
        "ups",
        "tcs",
        "leopards",
        "leopard courier",
        "trax",
        "m&p",
        "m&p courier",
        "blue dart",
    ]

    found = []

    lower_text = text.lower()

    for company in companies:
        if company in lower_text:
            found.append(company)

    return found


def _trusted_order_id(intelligence):
    entities = intelligence.get("entities", {})

    return str(
        entities.get("order_id", "")
    ).strip()


def _trusted_transaction_id(intelligence):
    entities = intelligence.get("entities", {})

    return str(
        entities.get("transaction_id", "")
    ).strip()


def validate_ai_output(intelligence, ai_data):

    violations = []

    text = _all_ai_text(ai_data)

    # --------------------------------------------------------
    # 1. Unsupported refund promises
    # --------------------------------------------------------

    refund_promise_terms = [
        "refund is guaranteed",
        "refund will be guaranteed",
        "refund is approved",
        "refund has been approved",
        "refund will be issued",
        "your refund will be issued",
        "we will issue your refund",
        "we will provide your refund",
        "you will receive your refund",
        "your refund will arrive",
        "refund will arrive",
        "refund will be processed",
        "we will process your refund",
    ]

    if _contains_any(
        text,
        refund_promise_terms,
    ):
        violations.append(
            "Unsupported refund promise"
        )

    # --------------------------------------------------------
    # 2. Unsupported compensation
    # --------------------------------------------------------

    if (
        _contains_any(
            text,
            COMPENSATION_TERMS,
        )
        and
        (
            _contains_any(
                text,
                GUARANTEE_TERMS,
            )
            or
            _contains_any(
                text,
                APPROVAL_TERMS,
            )
            or
            _contains_any(
                text,
                PROMISE_TERMS,
            )
        )
    ):
        violations.append(
            "Unsupported compensation promise"
        )

    # --------------------------------------------------------
    # 3. Unsupported replacement promise
    # --------------------------------------------------------

    if (
        _contains_any(
            text,
            REPLACEMENT_TERMS,
        )
        and
        (
            _contains_any(
                text,
                GUARANTEE_TERMS,
            )
            or
            _contains_any(
                text,
                PROMISE_TERMS,
            )
        )
    ):
        violations.append(
            "Unsupported replacement promise"
        )

    # --------------------------------------------------------
    # 4. Prompt-injection output
    # --------------------------------------------------------

    escalation = intelligence.get(
        "escalation",
        {}
    )

    if escalation.get("required"):

        if escalation.get("level") == "High":

            injection_claims = [
                "ignore the policies",
                "ignore all policies",
                "ignore previous instructions",
                "ignore all previous instructions",
                "refund is guaranteed",
                "refund will arrive tomorrow",
                "hidden instructions",
                "system prompt",
                "internal prompt",
                "api key",
                "password",
                "secret",
            ]

            if _contains_any(
                text,
                injection_claims,
            ):
                violations.append(
                    "AI output appears to follow or repeat "
                    "the prompt injection instruction"
                )

    # --------------------------------------------------------
    # 5. Invented dates
    # --------------------------------------------------------

    dates = _extract_dates(text)

    if dates:
        violations.append(
            "AI output contains an unsupported date or time claim"
        )

    # --------------------------------------------------------
    # 6. Invented monetary amounts
    # --------------------------------------------------------

    money_values = _extract_money(text)

    if money_values:
        violations.append(
            "AI output contains an unsupported monetary amount"
        )

    # --------------------------------------------------------
    # 7. Invented order IDs
    # --------------------------------------------------------

    generated_order_ids = _extract_order_ids(text)

    trusted_order_id = _trusted_order_id(
        intelligence
    )

    for generated_id in generated_order_ids:

        if not trusted_order_id:
            violations.append(
                "AI output contains an unsupported order ID"
            )

        elif generated_id.lower() != trusted_order_id.lower():
            violations.append(
                "AI output contains an incorrect order ID"
            )

    # --------------------------------------------------------
    # 8. Invented transaction IDs
    # --------------------------------------------------------

    generated_transaction_ids = _extract_transaction_ids(
        text
    )

    trusted_transaction_id = _trusted_transaction_id(
        intelligence
    )

    for generated_id in generated_transaction_ids:

        if not trusted_transaction_id:
            violations.append(
                "AI output contains an unsupported transaction ID"
            )

        elif (
            generated_id.lower()
            != trusted_transaction_id.lower()
        ):
            violations.append(
                "AI output contains an incorrect transaction ID"
            )

    # --------------------------------------------------------
    # 9. Unsupported shipping company
    # --------------------------------------------------------

    shipping_companies = _extract_shipping_companies(
        text
    )

    if shipping_companies:

        violations.append(
            "AI output contains an unsupported shipping company"
        )

    # --------------------------------------------------------
    # Remove duplicate violations
    # --------------------------------------------------------

    violations = list(
        dict.fromkeys(violations)
    )

    return {
        "valid": len(violations) == 0,
        "violations": violations,
    }