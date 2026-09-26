import os
import sys
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from api.workflow import build_workflow_fields
from api.audit import create_audit_log
from api.assignment import assign_complaint
from api.workflow_validation import validate_workflow


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ML_DIR = PROJECT_ROOT / "ml"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))


# ============================================================
# DATABASE
# ============================================================

from api.database import (
    complaints_collection,
    analyses_collection,
    users_collection,
    knowledge_documents_collection
)


# ============================================================
# SCHEMAS
# ============================================================

from api.schemas import (
ComplaintCreate,
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
    ComplaintAssignmentRequest,
    ReviewActionRequest,
    ReviewModifyRequest,
    ReviewReclassifyRequest,
    ReviewReassignRequest,
    ReviewCommentRequest,
    AgentCommentRequest,
    AgentResolveRequest,
    AgentEscalateRequest,
    UserStatusRequest,
)


# ============================================================
# AUTHENTICATION
# ============================================================

from api.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)

# ============================================================
# REVIEW
# ============================================================

from api.review import (
   approve_review,
    modify_review,
    reclassify_review,
    reassign_review,
    escalate_review,
    reject_review,
    add_review_comment,
    regenerate_review_response,
)

# ============================================================
# AGENT
# ============================================================

from api.agent import (
    start_handling,
    await_customer,
    resolve_complaint,
    escalate_complaint,
    add_agent_comment,
)

# ============================================================
# MANAGMENT
# ============================================================

from api.management import (
    get_management_complaints,
    get_management_complaint,
    get_escalated_complaints,
    reassign_management_complaint,
    get_sla_overview,
    get_operational_analytics,
    get_report_data,
    get_users,
    update_user_status,
    get_user_overview,
    get_audit_logs,
)

# ============================================================
# EXISTING ML / AI PIPELINE
# IMPORTANT:
# Do not replace these with different function names.
# ============================================================

from rule_engine import analyze_complaint
from genai import analyze_with_ai
from ml.knowledge_base.service import process_upload, search_documents
from ml.knowledge_base.processor import DocumentProcessingError

# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="SupportNova API",
    version="1.0.0"
)


# ============================================================
# SECURITY
# ============================================================

security = HTTPBearer()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    token_data = decode_access_token(token)

    if not token_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    try:
        user_object_id = ObjectId(
            token_data["user_id"]
        )

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid user ID"
        )

    user = users_collection.find_one({
        "_id": user_object_id
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    if user.get("status") != "Active":
        raise HTTPException(
            status_code=401,
            detail="Account is inactive"
        )

    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user["role"]
    }


# ============================================================
# ROLE AUTHORIZATION
# ============================================================

def require_roles(*allowed_roles):

    def role_checker(
        current_user=Depends(get_current_user)
    ):

        if current_user["role"] not in allowed_roles:

            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource"
            )

        return current_user

    return role_checker


# ============================================================
# GENERAL
# ============================================================

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


# ============================================================
# AUTHENTICATION
# ============================================================

@app.get("/api/auth/me")
def get_me(
    current_user=Depends(get_current_user)
):

    return current_user


@app.post(
    "/api/auth/register",
    response_model=UserResponse
)
def register_user(
    user: RegisterRequest
):

    email = user.email.lower().strip()

    existing_user = users_collection.find_one({
        "email": email
    })

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = hash_password(
        user.password
    )

    user_data = {
        "name": user.name,
        "email": email,

        # Password is NEVER stored as plaintext.
        "password": hashed_password,

        # Public registration is ALWAYS Customer.
        "role": "Customer",

        "status": "Active",

        "created_at": datetime.now(timezone.utc)
    }

    result = users_collection.insert_one(
        user_data
    )

    return {
        "id": str(result.inserted_id),
        "name": user_data["name"],
        "email": user_data["email"],
        "role": user_data["role"]
    }


@app.post(
    "/api/auth/login",
    response_model=LoginResponse
)
def login_user(
    user: LoginRequest
):

    email = user.email.lower().strip()

    existing_user = users_collection.find_one({
        "email": email
    })

    if not existing_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if existing_user.get("status") != "Active":

        raise HTTPException(
            status_code=401,
            detail="Account is inactive"
        )

    if not verify_password(
        user.password,
        existing_user["password"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        str(existing_user["_id"]),
        existing_user["role"]
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",

        "user": {
            "id": str(existing_user["_id"]),
            "name": existing_user["name"],
            "email": existing_user["email"],
            "role": existing_user["role"]
        }
    }


# ============================================================
# COMPLAINT CREATION
# CUSTOMER ONLY
# ============================================================

@app.post("/api/complaints")
def create_complaint(
    complaint: ComplaintCreate,

    current_user=Depends(
        require_roles("Customer")
    )
):

    # --------------------------------------------------------
    # Convert Pydantic model to dictionary
    # --------------------------------------------------------

    complaint_data = complaint.model_dump()

    # --------------------------------------------------------
    # Attach authenticated customer
    # --------------------------------------------------------

    complaint_data["user_id"] = current_user["id"]

    # --------------------------------------------------------
    # Creation timestamp
    # --------------------------------------------------------

    complaint_data["created_at"] = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # Save original complaint
    # --------------------------------------------------------

    result = complaints_collection.insert_one(
        complaint_data
    )

    complaint_id = str(
        result.inserted_id
    )

    # --------------------------------------------------------
    # Add ID for SupportNova processing
    # --------------------------------------------------------

    complaint_data["complaint_id"] = complaint_id

    # --------------------------------------------------------
    # Existing Rule Engine input
    # --------------------------------------------------------

    rule_engine_input = {

        "complaint_id": complaint_id,

        "title": complaint_data["title"],

        "text": complaint_data["description"],

        "order_id": complaint_data.get(
            "order_id"
        ),

        "transaction_id": complaint_data.get(
            "transaction_id"
        ),

        "product": complaint_data.get(
            "product"
        ),

        "amount": complaint_data.get(
            "amount"
        ),

        "date": complaint_data.get(
            "date"
        )
    }

    # ========================================================
    # EXISTING PIPELINE
    #
    # Complaint
    #     ↓
    # Rule Engine
    #     ↓
    # GenAI
    #     ↓
    # Analysis
    #     ↓
    # MongoDB
    # ========================================================

    analysis = analyze_complaint(
        rule_engine_input
    )

    analysis = analyze_with_ai(
        analysis
    )

    validation = validate_workflow(analysis)

    analysis["validation"] = validation
    analysis["manual_review_required"] = (
        validation["manual_review_required"]
    )

    workflow_fields = build_workflow_fields(
        analysis=analysis,
        customer_id=current_user["id"]
    )

    complaints_collection.update_one(
        {
            "_id": result.inserted_id
        },
        {
            "$set": workflow_fields
        }
    )

    create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user["role"],
        action="Complaint submitted",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "status": workflow_fields["status"]
        }
    )

    
    # --------------------------------------------------------
    # Save complete analysis
    # --------------------------------------------------------

    analyses_collection.insert_one({

        "complaint_id": complaint_id,

        "analysis": analysis,

        "created_at": datetime.now(
            timezone.utc
        )
    })

    return analysis


# ============================================================
# VIEW COMPLAINTS
#
# Customer:
#     Only own complaints
#
# Agent:
#     Staff complaint access
#
# Reviewer:
#     Staff complaint access
#
# Manager:
#     Staff complaint access
#
# Admin:
#     Staff complaint access
#
# More granular assignment/review permissions will be added
# when we build the staff workflow.
# ============================================================

@app.get("/api/complaints")
def get_complaints(current_user=Depends(get_current_user)):
    role = current_user["role"]

    if role == "Customer":
        query = {
            "user_id": current_user["id"]
        }

    elif role in {"Agent", "Reviewer", "Manager", "Admin"}:
        query = {}

    else:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access complaints"
        )

    complaints = []

    for complaint in complaints_collection.find(query).sort(
        "created_at",
        -1
    ):
        complaints.append({
            "id": str(complaint["_id"]),
            "title": complaint["title"],
            "description": complaint["description"],

            # IMPORTANT: user_id, not doc
            "user_id": str(
                complaint.get("user_id", "")
            ),

            "order_id": complaint.get("order_id"),
            "transaction_id": complaint.get("transaction_id"),
            "product": complaint.get("product"),
            "amount": complaint.get("amount"),
            "date": complaint.get("date"),

            "status": complaint.get(
                "status",
                "New"
            ),

            "assigned_to": complaint.get(
                "assigned_to"
            ),

            "assigned_department": complaint.get(
                "assigned_department"
            ),

            "manual_review_required": complaint.get(
                "manual_review_required",
                False
            ),

            "review_status": complaint.get(
                "review_status"
            ),

            "reviewer_id": complaint.get(
                "reviewer_id"
            ),

            "created_at": complaint[
                "created_at"
            ],

            "updated_at": complaint.get(
                "updated_at"
            ),

            "resolved_at": complaint.get(
                "resolved_at"
            ),

            "closed_at": complaint.get(
                "closed_at"
            ),
        })

    return complaints

# ============================================================
# VIEW SINGLE COMPLAINT
# ============================================================

@app.get(
    "/api/complaints/{complaint_id}"
)
def get_complaint(
    complaint_id: str,

    current_user=Depends(
        get_current_user
    )
):

    # --------------------------------------------------------
    # Validate ObjectId
    # --------------------------------------------------------

    try:

        object_id = ObjectId(
            complaint_id
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    # --------------------------------------------------------
    # Find complaint
    # --------------------------------------------------------

    complaint = complaints_collection.find_one({
        "_id": object_id
    })

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    role = current_user["role"]

    # --------------------------------------------------------
    # CUSTOMER OWNERSHIP
    # --------------------------------------------------------

    if role == "Customer":

        if complaint.get(
            "user_id"
        ) != current_user["id"]:

            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this complaint"
            )

    # --------------------------------------------------------
    # STAFF
    # --------------------------------------------------------

    elif role not in {
        "Agent",
        "Reviewer",
        "Manager",
        "Admin"
    }:

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access this complaint"
        )

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {

        "id": str(
            complaint["_id"]
        ),

        "title": complaint.get(
            "title"
        ),

        "description": complaint.get(
            "description"
        ),

        "order_id": complaint.get(
            "order_id"
        ),

        "transaction_id": complaint.get(
            "transaction_id"
        ),

        "product": complaint.get(
            "product"
        ),

        "amount": complaint.get(
            "amount"
        ),

        "date": complaint.get(
            "date"
        ),

        "created_at": complaint.get(
            "created_at"
        )
    }



# ============================================================
# VIEW COMPLAINT ANALYSIS
# ============================================================

@app.get(
    "/api/complaints/{complaint_id}/analysis"
)
def get_analysis(
    complaint_id: str,

    current_user=Depends(
        get_current_user
    )
):

    # --------------------------------------------------------
    # Validate complaint ID
    # --------------------------------------------------------

    try:

        complaint_object_id = ObjectId(
            complaint_id
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    # --------------------------------------------------------
    # Verify complaint exists
    # --------------------------------------------------------

    complaint = complaints_collection.find_one({

        "_id": complaint_object_id

    })

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    role = current_user["role"]

    # --------------------------------------------------------
    # CUSTOMER OWNERSHIP
    # --------------------------------------------------------

    if role == "Customer":

        if complaint.get(
            "user_id"
        ) != current_user["id"]:

            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this analysis"
            )

    # --------------------------------------------------------
    # STAFF
    # --------------------------------------------------------

    elif role not in {
        "Agent",
        "Reviewer",
        "Manager",
        "Admin"
    }:

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access this analysis"
        )

    # --------------------------------------------------------
    # Find analysis
    # --------------------------------------------------------

    analysis = analyses_collection.find_one({

        "complaint_id": complaint_id

    })

    if not analysis:

        raise HTTPException(
            status_code=404,
            detail="Analysis not found"
        )

    return analysis["analysis"]


@app.get("/api/complaints/{complaint_id}/activity")
def get_complaint_activity(
    complaint_id: str,
    current_user=Depends(get_current_user)
):
    try:
        complaint = complaints_collection.find_one(
            {"_id": ObjectId(complaint_id)}
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    role = current_user["role"]

    if role == "Customer":
        if str(complaint.get("user_id")) != str(
            current_user["id"]
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this complaint"
            )

    elif role not in {
        "Agent",
        "Reviewer",
        "Manager",
        "Admin"
    }:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access this complaint"
        )

    activities = []

    for activity in complaint_activity_collection.find(
        {
            "complaint_id": complaint_id
        }
    ).sort(
        "timestamp",
        1
    ):
        activities.append({
            "id": str(activity["_id"]),
            "timestamp": activity["timestamp"],
            "type": activity["type"],
            "title": activity["title"],
            "description": activity.get(
                "description",
                ""
            ),
            "actor": activity.get(
                "actor",
                "SupportNova"
            ),
            "actorRole": activity.get(
                "actor_role",
                "System"
            ),
        })

    return activities


from pydantic import BaseModel
from typing import Optional


class ComplaintUpdateRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_department: Optional[str] = None
    priority: Optional[str] = None


@app.patch("/api/complaints/{complaint_id}")
def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdateRequest,
    current_user=Depends(get_current_user)
):
    try:
        complaint = complaints_collection.find_one(
            {"_id": ObjectId(complaint_id)}
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint ID"
        )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    role = current_user["role"]

    if role not in {
        "Agent",
        "Reviewer",
        "Manager",
        "Admin"
    }:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update complaints"
        )

    update_fields = {}

    if payload.status is not None:
        update_fields["status"] = payload.status

    if payload.assigned_to is not None:
        update_fields["assigned_to"] = payload.assigned_to

    if payload.assigned_department is not None:
        update_fields[
            "assigned_department"
        ] = payload.assigned_department

    if payload.priority is not None:
        update_fields["priority"] = payload.priority

    now = datetime.now(timezone.utc).isoformat()

    update_fields["updated_at"] = now

    if payload.status == "Resolved":
        update_fields["resolved_at"] = now

    if payload.status == "Closed":
        update_fields["closed_at"] = now

    if not update_fields:
        return {
            "message": "Nothing to update"
        }

    complaints_collection.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": update_fields}
    )

    actor = current_user.get(
        "name",
        current_user.get(
            "email",
            "SupportNova User"
        )
    )

    actor_role = current_user.get(
        "role",
        "System"
    )

    if payload.status is not None:
        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="status",
            title=f"Status changed to {payload.status}",
            description=(
                f"Complaint status changed to "
                f"{payload.status}."
            ),
            actor=actor,
            actor_role=actor_role,
        )

    if payload.assigned_department is not None:
        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="routed",
            title="Department routing",
            description=(
                f"Complaint routed to "
                f"{payload.assigned_department}."
            ),
            actor=actor,
            actor_role=actor_role,
        )

    if payload.assigned_to is not None:
        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="assigned",
            title="Complaint assigned",
            description=(
                "Complaint assigned to a support agent."
            ),
            actor=actor,
            actor_role=actor_role,
        )

    updated = complaints_collection.find_one(
        {"_id": ObjectId(complaint_id)}
    )

    return {
        "id": str(updated["_id"]),
        "title": updated["title"],
        "description": updated["description"],
        "user_id": str(
            updated.get("user_id", "")
        ),
        "order_id": updated.get("order_id"),
        "transaction_id": updated.get(
            "transaction_id"
        ),
        "product": updated.get("product"),
        "amount": updated.get("amount"),
        "date": updated.get("date"),
        "status": updated.get(
            "status",
            "New"
        ),
        "assigned_to": updated.get(
            "assigned_to"
        ),
        "assigned_department": updated.get(
            "assigned_department"
        ),
        "manual_review_required": updated.get(
            "manual_review_required",
            False
        ),
        "review_status": updated.get(
            "review_status"
        ),
        "created_at": updated["created_at"],
        "updated_at": updated.get(
            "updated_at"
        ),
        "resolved_at": updated.get(
            "resolved_at"
        ),
        "closed_at": updated.get(
            "closed_at"
        ),
    }


@app.patch("/api/complaints/{complaint_id}/assign")
def assign_complaint_endpoint(
    complaint_id: str,
    request: ComplaintAssignmentRequest,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return assign_complaint(
        complaint_id=complaint_id,
        agent_id=request.agent_id,
        actor=current_user
    )

@app.get("/api/agent/queue")
def get_agent_queue(
    current_user=Depends(
        require_roles("Agent")
    )
):
    complaints = []

    for complaint in complaints_collection.find({
        "assigned_to": current_user["id"]
    }).sort(
        "updated_at",
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

            "status": complaint.get(
                "status",
                "New"
            ),

            "assigned_to": complaint.get(
                "assigned_to"
            ),

            "assigned_department": complaint.get(
                "assigned_department"
            ),

            "manual_review_required": complaint.get(
                "manual_review_required",
                False
            ),

            "review_status": complaint.get(
                "review_status"
            ),

            "created_at": complaint.get(
                "created_at"
            ),

            "updated_at": complaint.get(
                "updated_at"
            )
        })

    return complaints



@app.get("/api/review/queue")
def get_review_queue(
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    complaints = []

    for complaint in complaints_collection.find({
        "manual_review_required": True,
        "review_status": "Pending"
    }).sort(
        "updated_at",
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

            "status": complaint.get(
                "status",
                "New"
            ),

            "assigned_to": complaint.get(
                "assigned_to"
            ),

            "assigned_department": complaint.get(
                "assigned_department"
            ),

            "manual_review_required": complaint.get(
                "manual_review_required",
                False
            ),

            "review_status": complaint.get(
                "review_status"
            ),

            "reviewer_id": complaint.get(
                "reviewer_id"
            ),

            "created_at": complaint.get(
                "created_at"
            ),

            "updated_at": complaint.get(
                "updated_at"
            )
        })

    return complaints

# ============================================================
# REVIEWER ACTIONS
# REVIEWER ONLY
# ============================================================

@app.post(
    "/api/review/{complaint_id}/approve"
)
def approve_complaint_review(
    complaint_id: str,
    request: ReviewActionRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    return approve_review(
        complaint_id=complaint_id,
        reviewer=current_user,
        comment=request.comment
    )


@app.post(
    "/api/review/{complaint_id}/modify"
)
def modify_complaint_review(
    complaint_id: str,
    request: ReviewModifyRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    return modify_review(
        complaint_id=complaint_id,
        reviewer=current_user,
        comment=request.comment,
        customer_response=request.customer_response,
        agent_guidance=request.agent_guidance
    )


@app.post(
    "/api/review/{complaint_id}/reclassify"
)
def reclassify_complaint_review(
    complaint_id: str,
    request: ReviewReclassifyRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    return reclassify_review(
        complaint_id=complaint_id,
        reviewer=current_user,
        category=request.category,
        subcategory=request.subcategory,
        department=request.department,
        comment=request.comment
    )


@app.post(
    "/api/review/{complaint_id}/reassign"
)
def reassign_complaint_review(
    complaint_id: str,
    request: ReviewReassignRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    return reassign_review(
        complaint_id=complaint_id,
        reviewer=current_user,
        agent_id=request.agent_id,
        comment=request.comment
    )


@app.post(
    "/api/review/{complaint_id}/escalate"
)
def escalate_complaint_review(
    complaint_id: str,
    request: ReviewActionRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    if not request.comment:
        raise HTTPException(
            status_code=400,
            detail="Comment is required when escalating"
        )

    return escalate_review(
        complaint_id=complaint_id,
        reviewer=current_user,
        comment=request.comment
    )


@app.post(
    "/api/review/{complaint_id}/reject"
)
def reject_complaint_review(
    complaint_id: str,
    request: ReviewActionRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    if not request.comment:
        raise HTTPException(
            status_code=400,
            detail="Comment is required when rejecting"
        )

    return reject_review(
        complaint_id=complaint_id,
        reviewer=current_user,
        comment=request.comment
    )


@app.post(
    "/api/review/{complaint_id}/comment"
)
def comment_on_review(
    complaint_id: str,
    request: ReviewCommentRequest,
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    return add_review_comment(
        complaint_id=complaint_id,
        reviewer=current_user,
        comment=request.comment
    )

@app.post("/api/review/{complaint_id}/regenerate-response")
def regenerate_complaint_response(
    complaint_id: str,
    request: ReviewActionRequest,
    current_user=Depends(require_roles("Reviewer"))
):
    if not request.comment:
        raise HTTPException(
            status_code=400,
            detail="Comment is required when regenerating the response"
        )

    return regenerate_review_response(
        complaint_id=complaint_id,
        reviewer=current_user,
        comment=request.comment
    )

#////////////////////

@app.post("/api/agent/{complaint_id}/start")
def start_agent_handling(
    complaint_id: str,
    current_user=Depends(require_roles("Agent"))
):
    return start_handling(
        complaint_id=complaint_id,
        agent=current_user
    )


@app.post("/api/agent/{complaint_id}/await-customer")
def await_customer_response(
    complaint_id: str,
    request: AgentCommentRequest,
    current_user=Depends(require_roles("Agent"))
):
    return await_customer(
        complaint_id=complaint_id,
        agent=current_user,
        comment=request.comment
    )


@app.post("/api/agent/{complaint_id}/resolve")
def resolve_agent_complaint(
    complaint_id: str,
    request: AgentResolveRequest,
    current_user=Depends(require_roles("Agent"))
):
    return resolve_complaint(
        complaint_id=complaint_id,
        agent=current_user,
        comment=request.comment
    )


@app.post("/api/agent/{complaint_id}/escalate")
def escalate_agent_complaint(
    complaint_id: str,
    request: AgentEscalateRequest,
    current_user=Depends(require_roles("Agent"))
):
    return escalate_complaint(
        complaint_id=complaint_id,
        agent=current_user,
        comment=request.comment
    )


@app.post("/api/agent/{complaint_id}/comment")
def add_agent_complaint_comment(
    complaint_id: str,
    request: AgentCommentRequest,
    current_user=Depends(require_roles("Agent"))
):
    return add_agent_comment(
        complaint_id=complaint_id,
        agent=current_user,
        comment=request.comment
    )

# ============================================================
# MANAGEMENT / ADMIN
# ============================================================

@app.get("/api/management/complaints")
def management_complaints(
    status: str | None = None,
    department: str | None = None,
    assigned_to: str | None = None,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_management_complaints(
        status=status,
        department=department,
        assigned_to=assigned_to
    )


@app.get("/api/management/complaints/{complaint_id}")
def management_complaint_detail(
    complaint_id: str,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_management_complaint(
        complaint_id
    )


@app.get("/api/management/escalations")
def management_escalations(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_escalated_complaints()


@app.post("/api/management/complaints/{complaint_id}/reassign")
def management_reassign(
    complaint_id: str,
    request: ReviewReassignRequest,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return reassign_management_complaint(
        complaint_id=complaint_id,
        agent_id=request.agent_id,
        actor=current_user
    )


@app.get("/api/management/sla")
def management_sla(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_sla_overview()


@app.get("/api/management/analytics")
def management_analytics(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_operational_analytics()


@app.get("/api/management/reports")
def management_reports(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_report_data()


# ============================================================
# USER MANAGEMENT
# ============================================================

@app.get("/api/admin/users")
def admin_users(
    role: str | None = None,
    status: str | None = None,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return get_users(
        role=role,
        status=status
    )


@app.patch("/api/admin/users/{user_id}/status")
def admin_update_user_status(
    user_id: str,
    request: UserStatusRequest,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return update_user_status(
        user_id=user_id,
        status=request.status,
        actor=current_user
    )


@app.get("/api/admin/users/overview")
def admin_user_overview(
    current_user=Depends(
        require_roles("Admin")
    )
):
    return get_user_overview()


@app.get("/api/admin/audit")
def admin_audit_logs(
    limit: int = 100,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return get_audit_logs(
        limit=limit
    )
# ============================================================
# KNOWLEDGE BASE
# ============================================================

@app.post("/api/admin/knowledge-base/documents")
async def upload_knowledge_document(
    file: UploadFile = File(...),
    version: str = Query(..., min_length=1, max_length=40),
    title: str | None = Query(default=None, max_length=200),
    current_user=Depends(require_roles("Admin")),
):
    if file.content_type not in {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        raise HTTPException(status_code=415, detail="Only PDF and DOCX documents are supported")
    try:
        document = process_upload(await file.read(), file.filename or "document", version, title)
    except DocumentProcessingError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    existing = knowledge_documents_collection.find_one({"title": document["title"], "status": "Active"})
    if existing:
        knowledge_documents_collection.update_many(
            {"title": document["title"], "status": "Active"},
            {"$set": {"status": "Superseded", "superseded_at": datetime.now(timezone.utc)}}
        )
    knowledge_documents_collection.insert_one(document)
    create_audit_log(actor_id=current_user["id"], actor_role=current_user["role"],
                     action="Knowledge-base document uploaded", entity_type="knowledge_document",
                     entity_id=document["document_id"], details={"version": version, "filename": document["filename"]})
    document.pop("_id", None)
    return document


@app.get("/api/admin/knowledge-base/documents")
def list_knowledge_documents(current_user=Depends(require_roles("Admin", "Manager", "Reviewer"))):
    return [{k: v for k, v in document.items() if k not in {"_id", "text", "chunks"}}
            for document in knowledge_documents_collection.find({}, {"text": 0, "chunks": 0}).sort("uploaded_at", -1)]


@app.get("/api/knowledge-base/search")
def search_knowledge(query: str = Query(..., min_length=1, max_length=300),
                    current_user=Depends(get_current_user)):
    documents = list(knowledge_documents_collection.find({"status": "Active"}))
    return {"query": query, "results": search_documents(documents, query)}
