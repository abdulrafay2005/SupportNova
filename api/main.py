import sys
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from bson import ObjectId

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ML_DIR = PROJECT_ROOT / "ml"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))


from api.database import complaints_collection, analyses_collection
from api.schemas import ComplaintCreate

from rule_engine import analyze_complaint
from genai import analyze_with_ai


app = FastAPI(
    title="SupportNova API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "name": "SupportNova",
        "status": "running"
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "database": "MongoDB Atlas"
    }


@app.post("/api/complaints")
def create_complaint(complaint: ComplaintCreate):

    # Convert Pydantic model to dictionary
    complaint_data = complaint.model_dump()

    # Save original complaint
    complaint_data["created_at"] = datetime.now(timezone.utc)

    result = complaints_collection.insert_one(complaint_data)

    complaint_id = str(result.inserted_id)

    # Add ID for SupportNova
    complaint_data["complaint_id"] = complaint_id

    # Run existing rule engine
    # Prepare input for the existing rule engine
    rule_engine_input = {
    "complaint_id": complaint_id,
    "title": complaint_data["title"],
    "text": complaint_data["description"],
    "order_id": complaint_data.get("order_id"),
    "transaction_id": complaint_data.get("transaction_id"),
    "product": complaint_data.get("product"),
    "amount": complaint_data.get("amount"),
    "date": complaint_data.get("date")
    }

    # Run existing rule engine
    analysis = analyze_complaint(rule_engine_input)

    # Run existing AI layer
    analysis = analyze_with_ai(analysis)

    # Save complete analysis
    analyses_collection.insert_one({
        "complaint_id": complaint_id,
        "analysis": analysis,
        "created_at": datetime.now(timezone.utc)
    })

    return analysis


@app.get("/api/complaints")
def get_complaints():

    complaints = []

    for complaint in complaints_collection.find().sort(
        "created_at",
        -1
    ):

        complaints.append({
            "id": str(complaint["_id"]),
            "title": complaint["title"],
            "description": complaint["description"],
            "order_id": complaint.get("order_id"),
            "transaction_id": complaint.get("transaction_id"),
            "product": complaint.get("product"),
            "amount": complaint.get("amount"),
            "date": complaint.get("date"),
            "created_at": complaint["created_at"]
        })

    return complaints


@app.get("/api/complaints/{complaint_id}")
def get_complaint(complaint_id: str):

    try:
        object_id = ObjectId(complaint_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    complaint = complaints_collection.find_one({
        "_id": object_id
    })

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    return {
        "id": str(complaint["_id"]),
        "title": complaint["title"],
        "description": complaint["description"],
        "order_id": complaint.get("order_id"),
        "transaction_id": complaint.get("transaction_id"),
        "product": complaint.get("product"),
        "amount": complaint.get("amount"),
        "date": complaint.get("date"),
        "created_at": complaint["created_at"]
    }


@app.get("/api/complaints/{complaint_id}/analysis")
def get_analysis(complaint_id: str):

    analysis = analyses_collection.find_one({
        "complaint_id": complaint_id
    })

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found"
        )

    return analysis["analysis"]