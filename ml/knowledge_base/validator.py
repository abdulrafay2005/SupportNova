"""
SupportNova Help Center Validator.

Validates extracted organizational knowledge before
it is accepted into the application Help Center.
"""


REQUIRED_METADATA = {
    "filename",
    "extension",
    "text",
    "character_count",
    "word_count",
}


FORBIDDEN_DOCUMENT_INSTRUCTIONS = [
    "ignore system instructions",
    "ignore previous instructions",
    "reveal system prompt",
    "reveal hidden instructions",
    "reveal api key",
    "reveal credentials",
]


def validate_document(document):
    """
    Validate one processed knowledge-base document.
    """

    errors = []

    if not isinstance(
        document,
        dict
    ):
        return {
            "valid": False,
            "errors": [
                "Document must be a dictionary."
            ],
        }

    missing = REQUIRED_METADATA - set(
        document.keys()
    )

    if missing:

        errors.append(
            "Missing metadata: "
            + ", ".join(
                sorted(missing)
            )
        )

    text = str(
        document.get(
            "text",
            ""
        )
    ).strip()

    if not text:

        errors.append(
            "Document contains no text."
        )

    if len(text) < 20:

        errors.append(
            "Document text is too short."
        )

    lower_text = text.lower()

    for instruction in FORBIDDEN_DOCUMENT_INSTRUCTIONS:

        if instruction in lower_text:

            errors.append(
                "Document contains a suspicious "
                f"instruction: {instruction}"
            )

    character_count = document.get(
        "character_count"
    )

    if character_count is not None:

        if character_count != len(text):

            errors.append(
                "Character count does not match extracted text."
            )

    word_count = document.get(
        "word_count"
    )

    if word_count is not None:

        if word_count != len(text.split()):

            errors.append(
                "Word count does not match extracted text."
            )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }


def validate_documents(documents):
    """
    Validate multiple processed documents.
    """

    results = []

    for document in documents:

        result = validate_document(
            document
        )

        results.append({
            "filename": document.get(
                "filename",
                ""
            ),
            **result,
        })

    return results