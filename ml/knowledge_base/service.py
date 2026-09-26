"""Persistence and retrieval services for uploaded policy documents."""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from tempfile import NamedTemporaryFile
import re

from .processor import process_document, DocumentProcessingError
from .validator import validate_document


def _chunks(text: str, size: int = 1200, overlap: int = 150):
    words = text.split()
    result = []
    step = max(1, size - overlap)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start:start + size]).strip()
        if chunk:
            result.append({"index": len(result), "text": chunk})
        if start + size >= len(words):
            break
    return result


def process_upload(contents: bytes, filename: str, version: str, title: str | None = None):
    suffix = Path(filename).suffix.lower()
    if suffix not in {".pdf", ".docx"}:
        raise DocumentProcessingError("Only PDF and DOCX documents are supported")
    if not contents:
        raise DocumentProcessingError("Uploaded document is empty")
    digest = sha256(contents).hexdigest()
    with NamedTemporaryFile(suffix=suffix) as temporary:
        temporary.write(contents)
        temporary.flush()
        document = process_document(temporary.name)
    document.update({
        "filename": filename,
        "title": title or Path(filename).stem,
        "version": version,
        "document_id": f"DOC-{digest[:16]}",
        "content_hash": digest,
        "uploaded_at": datetime.now(timezone.utc),
        "status": "Active",
        "chunks": _chunks(document["text"]),
        "source_references": [
            {"document_id": f"DOC-{digest[:16]}", "filename": filename,
             "version": version, "chunk_index": chunk["index"]}
            for chunk in _chunks(document["text"])
        ],
    })
    validation = validate_document(document)
    if not validation["valid"]:
        raise DocumentProcessingError("; ".join(validation["errors"]))
    return document


def search_documents(documents, query: str):
    terms = set(re.findall(r"\w+", query.lower()))
    if not terms:
        return []
    matches = []
    for document in documents:
        active = document.get("status") == "Active"
        for chunk in document.get("chunks", []):
            score = len(terms & set(re.findall(r"\w+", chunk["text"].lower())))
            if active and score:
                matches.append({"score": score, "document_id": document["document_id"],
                                "title": document["title"], "version": document["version"],
                                "source": document["source_references"][chunk["index"]],
                                "text": chunk["text"]})
    return sorted(matches, key=lambda item: item["score"], reverse=True)
