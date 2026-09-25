"""
SupportNova Help Center Storage.

Stores processed and validated knowledge-base documents
in a local JSON file and provides simple keyword search.
"""

from pathlib import Path
import json
import re


# ============================================================
# PATHS
# ============================================================

DEFAULT_STORAGE_PATH = (
    Path(__file__).resolve().parent
    / "knowledge_base.json"
)


# ============================================================
# SAVE
# ============================================================

def save_knowledge_base(
    documents,
    storage_path=DEFAULT_STORAGE_PATH
):
    """
    Save validated knowledge-base documents to JSON.
    """

    storage_path = Path(storage_path)

    storage_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    payload = {
        "document_count": len(documents),
        "documents": documents
    }

    with open(
        storage_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            payload,
            file,
            indent=2,
            ensure_ascii=False
        )

    return storage_path


# ============================================================
# LOAD
# ============================================================

def load_knowledge_base(
    storage_path=DEFAULT_STORAGE_PATH
):
    """
    Load the Help Center from JSON.

    Returns the complete stored knowledge-base object.
    """

    storage_path = Path(storage_path)

    if not storage_path.exists():
        return {
            "document_count": 0,
            "documents": []
        }

    with open(
        storage_path,
        "r",
        encoding="utf-8"
    ) as file:

        data = json.load(file)

    return data


# ============================================================
# SEARCH HELPERS
# ============================================================

def _tokenize(text):

    return set(
        re.findall(
            r"\b[a-zA-Z0-9]+\b",
            str(text).lower()
        )
    )


# ============================================================
# SEARCH
# ============================================================

def search_knowledge_base(
    knowledge_base,
    query
):
    """
    Search the Help Center using keyword matching.

    Returns documents ranked by the number of matching
    query terms.
    """

    if not query:
        return []

    # Accept either:
    #
    # {
    #     "document_count": 3,
    #     "documents": [...]
    # }
    #
    # or a plain list of documents.

    if isinstance(
        knowledge_base,
        dict
    ):

        documents = knowledge_base.get(
            "documents",
            []
        )

    elif isinstance(
        knowledge_base,
        list
    ):

        documents = knowledge_base

    else:

        return []

    query_terms = _tokenize(
        query
    )

    if not query_terms:
        return []

    ranked_results = []

    for document in documents:

        if not isinstance(
            document,
            dict
        ):
            continue

        text = str(
            document.get(
                "text",
                ""
            )
        )

        filename = str(
            document.get(
                "filename",
                ""
            )
        )

        searchable_text = (
            text + " " + filename
        )

        document_terms = _tokenize(
            searchable_text
        )

        matches = (
            query_terms
            & document_terms
        )

        score = len(matches)

        if score > 0:

            result = dict(
                document
            )

            result["search_score"] = score

            ranked_results.append(
                result
            )

    ranked_results.sort(
        key=lambda item: item["search_score"],
        reverse=True
    )

    return ranked_results