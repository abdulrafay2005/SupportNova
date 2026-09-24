"""
SupportNova Knowledge Base Builder.

Processes documents, validates them, and stores only
valid documents in the local knowledge base.
"""

from pathlib import Path
import sys


# ------------------------------------------------------------------
# Python path
# ------------------------------------------------------------------

KNOWLEDGE_BASE_DIR = Path(__file__).resolve().parent

if str(KNOWLEDGE_BASE_DIR) not in sys.path:
    sys.path.insert(0, str(KNOWLEDGE_BASE_DIR))


from processor import process_directory
from validator import validate_document
from storage import save_knowledge_base


# ------------------------------------------------------------------
# Project paths
# ------------------------------------------------------------------

ML_DIR = KNOWLEDGE_BASE_DIR.parent

DOCUMENT_DIR = ML_DIR / "kb_documents"


# ------------------------------------------------------------------
# Knowledge base build
# ------------------------------------------------------------------

def build_knowledge_base():

    print("=" * 70)
    print("SUPPORTNOVA KNOWLEDGE BASE BUILDER")
    print("=" * 70)

    print()
    print("Source directory:", DOCUMENT_DIR)

    documents = process_directory(
        DOCUMENT_DIR
    )

    print()
    print("Documents discovered:", len(documents))

    valid_documents = []

    for document in documents:

        validation = validate_document(
            document
        )

        if validation["valid"]:

            print(
                f"[PASS] {document['filename']}"
            )

            valid_documents.append(
                document
            )

        else:

            print(
                f"[REJECT] {document['filename']}"
            )

            for error in validation["errors"]:

                print(
                    "       -",
                    error
                )

    storage_path = save_knowledge_base(
        valid_documents
    )

    print()
    print("Valid documents:", len(valid_documents))

    print(
        "Knowledge base saved to:",
        storage_path
    )

    print()
    print("=" * 70)
    print("KNOWLEDGE BASE BUILD COMPLETE")
    print("=" * 70)

    return valid_documents


if __name__ == "__main__":
    build_knowledge_base()