import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from api.workflow import build_workflow_fields, COMPLAINT_STATUSES
from api.audit import create_audit_log
from api.assignment import assign_complaint, auto_assign_complaint
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
    knowledge_documents_collection,
    complaint_activity_collection,
    ensure_indexes
)
from api.departments import (
    create_department,
    ensure_departments_seeded,
    get_department_staff,
    get_departments,
    update_department,
)
from api.staff import (
    create_staff_user,
    get_assignable_agents,
    update_staff_user,
)
from api.activity import create_complaint_activity


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
    CustomerRespondRequest,
    UserStatusRequest,
    StaffCreateRequest,
    StaffUpdateRequest,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
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
    get_review_statistics,
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
    customer_respond,
    get_agent_statistics,
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
    get_audit_summary,
    get_admin_statistics,
)

# ============================================================
# ANALYTICS / REPORTS / SLA (read-only aggregations)
# ============================================================

from api.reports import (
    REPORT_TYPES,
    UnknownReportType,
    generate_report,
    list_reports,
    render_report_csv,
)
from api.sla import build_sla_fields, get_sla_status

from api.analytics import (
    get_complaint_trends,
    get_department_performance,
    get_resolution_statistics,
    get_sentiment_distribution,
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

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Create the analytics/reporting indexes once at startup.

    `ensure_indexes()` never raises, so an unreachable database
    cannot stop the API from starting.
    """

    ensure_indexes()
    ensure_departments_seeded()

    yield


app = FastAPI(
    title="SupportNova API",
    version="1.0.0",
    lifespan=lifespan
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
    """
    Profile of the authenticated account.

    `get_current_user` carries only the identity fields the
    authorization layer needs. The profile screen also has to show
    the department a staff member belongs to and when the account
    was created, so those stored fields are read here. Nothing is
    computed and the password hash is never returned.
    """

    stored = users_collection.find_one(
        {"_id": ObjectId(current_user["id"])},
        {"password": 0},
    ) or {}

    return {
        **current_user,
        "department": stored.get("department"),
        "status": stored.get("status"),
        "phone": stored.get("phone"),
        "created_at": stored.get("created_at"),
        "updated_at": stored.get("updated_at"),
    }


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

    rule_result = analyze_complaint(
        rule_engine_input
    )

    analysis = analyze_with_ai(
        rule_result
    )

    validation = validate_workflow(analysis)

    analysis["validation"] = validation
    analysis["manual_review_required"] = (
        validation["manual_review_required"]
    )

    # --------------------------------------------------------
    # SLA / PRIORITY PERSISTENCE (additive)
    #
    # The rule engine already derives a real priority and SLA
    # window, but `create_intelligence()` does not carry them
    # into the AI result, so they were previously lost. They are
    # attached here, AFTER validation, exactly like `validation`
    # and `manual_review_required` above, so neither the rule
    # engine, the AI layer nor schema validation is affected.
    #
    # Nothing is invented: when the rule engine produces no SLA
    # window, no SLA field is written and the complaint is
    # reported as having no target.
    # --------------------------------------------------------

    rule_priority = rule_result.get("priority")
    rule_sla_hours = rule_result.get("sla_hours")

    if rule_priority:
        analysis["priority"] = rule_priority

    if rule_sla_hours:
        analysis["sla_hours"] = rule_sla_hours

    workflow_fields = build_workflow_fields(
        analysis=analysis,
        customer_id=current_user["id"]
    )

    persisted_fields = dict(workflow_fields)

    if rule_priority:
        persisted_fields["priority"] = rule_priority

    persisted_fields.update(
        build_sla_fields(
            created_at=workflow_fields.get(
                "created_at",
                complaint_data["created_at"],
            ),
            sla_hours=rule_sla_hours,
        )
    )

    complaints_collection.update_one(
        {
            "_id": result.inserted_id
        },
        {
            "$set": persisted_fields
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
    # Persistent timeline events.
    #
    # Each entry is recorded only because the corresponding
    # backend operation above actually ran: submission,
    # rule-engine + GenAI analysis, and independent Python
    # validation.
    # --------------------------------------------------------

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="submitted",
        title="Complaint submitted",
        description="Complaint received by SupportNova.",
        actor=current_user.get("name", "Customer"),
        actor_role="Customer",
        customer_visible=True,
    )

    classification = analysis.get("classification", {})

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="classified",
        title="System analysis completed",
        description=(
            "Complaint classified and policy analysis "
            "completed."
        ),
        metadata={
            "category": classification.get("category"),
            "subcategory": classification.get("subcategory"),
            "department": classification.get("department"),
            "escalation_required": analysis.get(
                "escalation", {}
            ).get("required"),
        },
    )

    create_complaint_activity(
        complaint_id=complaint_id,
        activity_type="status",
        title="Ground-truth validation completed",
        description=(
            "Independent Python validation completed."
        ),
        metadata={
            "validation_status": validation.get("status"),
            "manual_review_required": validation.get(
                "manual_review_required"
            ),
        },
    )

    # --------------------------------------------------------
    # AUTOMATIC ROUTING
    #
    # Manual-review complaints go to the reviewer queue and
    # are NOT auto-assigned. Normal complaints are assigned
    # to an active agent automatically.
    # --------------------------------------------------------

    if workflow_fields["status"] == "Manual Review":
        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="routed",
            title="Manual review required",
            description=(
                "Complaint routed to the reviewer queue."
            ),
            metadata={
                "reasons": validation.get("reasons", []),
            },
        )

    elif workflow_fields["status"] == "Escalated":
        create_complaint_activity(
            complaint_id=complaint_id,
            activity_type="escalated",
            title="Escalation detected during analysis",
            description=(
                "Complaint entered the escalation workflow."
            ),
            metadata={
                "level": analysis.get(
                    "escalation", {}
                ).get("level"),
            },
        )

    else:
        auto_assign_complaint(
            complaint_object_id=result.inserted_id,
            complaint_id=complaint_id,
            department=workflow_fields.get(
                "assigned_department"
            ),
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

    # --------------------------------------------------------
    # Attach the PERSISTED workflow state to the response so
    # the frontend never has to guess the routing outcome
    # (Manual Review / Escalated / Assigned / Analyzed).
    # Internal fields (assigned agent id, reviewer state
    # detail) are not exposed to the customer here.
    # --------------------------------------------------------
    stored = complaints_collection.find_one(
        {"_id": result.inserted_id}
    ) or {}

    analysis["workflow"] = {
        "complaint_id": complaint_id,
        "status": stored.get("status"),
        "assigned_department": stored.get(
            "assigned_department"
        ),
    }

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

# ============================================================
# ANALYSIS SUMMARIES FOR LIST VIEWS
#
# Complaint list surfaces need the classification the analysis
# pipeline already produced (category, subcategory, sentiment,
# escalation). Those live in `analyses`, so they are fetched once
# per request and merged in. Nothing is derived or guessed: a
# complaint without an analysis document simply has no values.
# ============================================================

def _analysis_summaries(complaint_ids: list[str]) -> dict:
    if not complaint_ids:
        return {}

    summaries: dict = {}

    for document in analyses_collection.find({
        "complaint_id": {"$in": complaint_ids}
    }):
        analysis = document.get("analysis") or {}

        classification = analysis.get("classification") or {}
        escalation = analysis.get("escalation") or {}
        sentiment = analysis.get("sentiment") or {}
        routing = analysis.get("routing") or {}

        label = sentiment.get("label")

        summaries[document.get("complaint_id")] = {
            "category": classification.get("category") or None,
            "subcategory": (
                classification.get("subcategory") or None
            ),
            "analysis_department": (
                routing.get("primary_department")
                or classification.get("department")
                or None
            ),
            "sentiment": (
                label.strip()
                if isinstance(label, str) and label.strip()
                else None
            ),
            "escalation_required": bool(
                escalation.get("required")
            ),
            "escalation_level": (
                escalation.get("level") or None
            ),
        }

    return summaries


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
        entry = {
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

            "assigned_department": complaint.get(
                "assigned_department"
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
        }

        # Internal workflow fields are staff-only. Customers
        # already only receive their own complaints; they do
        # not receive assignment or review internals.
        if role != "Customer":
            entry["assigned_to"] = complaint.get(
                "assigned_to"
            )
            entry["manual_review_required"] = complaint.get(
                "manual_review_required",
                False
            )
            entry["review_status"] = complaint.get(
                "review_status"
            )
            entry["reviewer_id"] = complaint.get(
                "reviewer_id"
            )

        entry["priority"] = complaint.get("priority")
        entry["sla_due_at"] = complaint.get("sla_due_at")

        complaints.append(entry)

    summaries = _analysis_summaries(
        [entry["id"] for entry in complaints]
    )

    for entry in complaints:
        summary = summaries.get(entry["id"])

        entry["category"] = (
            summary.get("category") if summary else None
        )
        entry["subcategory"] = (
            summary.get("subcategory") if summary else None
        )
        entry["sentiment"] = (
            summary.get("sentiment") if summary else None
        )
        entry["escalation_required"] = (
            summary.get("escalation_required")
            if summary
            else None
        )
        entry["escalation_level"] = (
            summary.get("escalation_level") if summary else None
        )
        entry["analysis_available"] = summary is not None

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
    #
    # Customers get a customer-safe subset. Staff also get
    # workflow fields plus the ACTUAL complaint submitter's
    # identity (never the currently logged-in user).
    # --------------------------------------------------------

    response = {

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

        "status": complaint.get(
            "status",
            "New"
        ),

        "assigned_department": complaint.get(
            "assigned_department"
        ),

        "customer_facing_request": complaint.get(
            "customer_facing_request"
        ),

        "resolution_comment": complaint.get(
            "resolution_comment"
        ),

        # Customer responses are customer-safe: they were
        # written by the complaint owner.
        "customer_responses": [
            {
                "message": entry.get("message"),
                "created_at": entry.get("created_at"),
            }
            for entry in complaint.get(
                "customer_responses", []
            )
        ],

        "created_at": complaint.get(
            "created_at"
        ),

        "updated_at": complaint.get(
            "updated_at"
        ),

        "resolved_at": complaint.get(
            "resolved_at"
        ),

        "closed_at": complaint.get(
            "closed_at"
        )
    }

    if role == "Customer":
        return response

    # ----- staff-only fields -----

    response["assigned_to"] = complaint.get("assigned_to")
    response["manual_review_required"] = complaint.get(
        "manual_review_required",
        False
    )
    response["review_status"] = complaint.get(
        "review_status"
    )
    response["reviewer_id"] = complaint.get("reviewer_id")
    response["user_id"] = str(complaint.get("user_id", ""))

    # Actual complaint submitter (owner) identity.
    owner = None
    owner_id = complaint.get("user_id")

    if owner_id:
        try:
            owner = users_collection.find_one(
                {"_id": ObjectId(str(owner_id))}
            )
        except Exception:
            owner = None

    response["customer"] = (
        {
            "id": str(owner["_id"]),
            "name": owner.get("name"),
            "email": owner.get("email"),
            "phone": owner.get("phone"),
        }
        if owner
        else None
    )

    # Assigned agent identity for display.
    agent_doc = None
    assigned_to = complaint.get("assigned_to")

    if assigned_to:
        try:
            agent_doc = users_collection.find_one(
                {"_id": ObjectId(str(assigned_to))}
            )
        except Exception:
            agent_doc = None

    response["assigned_agent"] = (
        {
            "id": str(agent_doc["_id"]),
            "name": agent_doc.get("name"),
        }
        if agent_doc
        else None
    )

    return response



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

    query = {
        "complaint_id": complaint_id
    }

    # Customers only see customer-facing updates; internal
    # workflow events (notes, guidance, validation internals,
    # reviewer activity) stay staff-only.
    if role == "Customer":
        query["customer_visible"] = True

    activities = []

    for activity in complaint_activity_collection.find(
        query
    ).sort(
        "timestamp",
        1
    ):
        entry = {
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
        }

        if role != "Customer":
            entry["metadata"] = activity.get(
                "metadata",
                {}
            )

        activities.append(entry)

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

    # --------------------------------------------------------
    # WORKFLOW AUTHORITY vs VISIBILITY
    #
    # Agents and Reviewers must use their dedicated workflow
    # endpoints (/api/agent/*, /api/review/*), which enforce
    # assignment / pending-review state and write audit logs.
    #
    # Managers and Admins may intervene through this generic
    # endpoint only after a complaint has been escalated into
    # the management workflow. Assignment changes go through
    # /api/complaints/{id}/assign or the management reassign
    # endpoint, which validate the target agent.
    # --------------------------------------------------------

    if role in {"Agent", "Reviewer"}:
        raise HTTPException(
            status_code=403,
            detail=(
                "Use the dedicated agent/review workflow "
                "endpoints to act on complaints"
            )
        )

    if role not in {"Manager", "Admin"}:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update complaints"
        )

    if complaint.get("status") != "Escalated":
        raise HTTPException(
            status_code=409,
            detail=(
                "Management can only update complaints that "
                "have been escalated. Use the assignment or "
                "management reassign endpoints for routing."
            )
        )

    update_fields = {}

    if payload.status is not None:
        # One source of truth for status values: the
        # canonical lifecycle set in api.workflow.
        if payload.status not in COMPLAINT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid status '{payload.status}'. "
                    f"Allowed: "
                    f"{', '.join(sorted(COMPLAINT_STATUSES))}."
                )
            )

        update_fields["status"] = payload.status

    if payload.assigned_to is not None:
        update_fields["assigned_to"] = payload.assigned_to

    if payload.assigned_department is not None:
        update_fields[
            "assigned_department"
        ] = payload.assigned_department

    if payload.priority is not None:
        update_fields["priority"] = payload.priority

    # Timestamps are stored as datetime objects, matching
    # every other write path in the workflow.
    now = datetime.now(timezone.utc)

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

    create_audit_log(
        actor_id=current_user["id"],
        actor_role=actor_role,
        action="Management: Escalated complaint updated",
        entity_type="complaint",
        entity_id=complaint_id,
        details={
            "previous_status": complaint.get("status"),
            "updated_fields": {
                key: value
                for key, value in update_fields.items()
                if key != "updated_at"
            }
        }
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

@app.get("/api/agent/statistics")
def agent_statistics(
    current_user=Depends(
        require_roles("Agent")
    )
):
    """Workload statistics for the signed-in agent only."""

    return get_agent_statistics(current_user)


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

            "priority": complaint.get("priority"),

            "sla_due_at": complaint.get("sla_due_at"),

            "created_at": complaint.get(
                "created_at"
            ),

            "updated_at": complaint.get(
                "updated_at"
            )
        })

    # Real classification from the stored analysis, so the agent
    # queue shows the category the pipeline actually produced.
    summaries = _analysis_summaries(
        [item["id"] for item in complaints]
    )

    for item in complaints:
        summary = summaries.get(item["id"]) or {}

        item["category"] = summary.get("category")
        item["subcategory"] = summary.get("subcategory")
        item["sentiment"] = summary.get("sentiment")
        item["escalation_required"] = summary.get(
            "escalation_required"
        )
        item["escalation_level"] = summary.get(
            "escalation_level"
        )
        item["analysis_available"] = bool(summary)

    return complaints



@app.get("/api/review/statistics")
def review_statistics(
    current_user=Depends(
        require_roles("Reviewer", "Manager", "Admin")
    )
):
    """
    Manual-review queue and outcome statistics.

    Reviewers see their own activity in `my_statistics`;
    managers and admins get the same aggregate view without it.
    """

    return get_review_statistics(
        current_user
        if current_user.get("role") == "Reviewer"
        else None
    )


@app.get("/api/review/queue")
def get_review_queue(
    current_user=Depends(
        require_roles("Reviewer")
    )
):
    """
    Return complaints that are currently waiting for reviewer action.

    Canonical review state:
        manual_review_required = True
        status = "Manual Review"
        review_status = "Pending"

    Also accepts the legacy/manual-test state where review_status
    is missing/null but the complaint is explicitly in Manual Review.
    """

    query = {
        "manual_review_required": True,
        "status": "Manual Review",
        "$or": [
            {
                "review_status": "Pending"
            },
            {
                "review_status": None
            }
        ]
    }

    complaints = []

    for complaint in complaints_collection.find(query).sort(
        "updated_at",
        -1
    ):
        complaints.append({
            "id": str(complaint["_id"]),

            "title": complaint.get(
                "title",
                ""
            ),

            "description": complaint.get(
                "description",
                ""
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

            "review_status": (
                complaint.get("review_status")
                or "Pending"
            ),

            "reviewer_id": complaint.get(
                "reviewer_id"
            ),

            "priority": complaint.get("priority"),

            "created_at": complaint.get(
                "created_at"
            ),

            "updated_at": complaint.get(
                "updated_at"
            )
        })

    summaries = _analysis_summaries(
        [item["id"] for item in complaints]
    )

    for item in complaints:
        summary = summaries.get(item["id"]) or {}

        item["category"] = summary.get("category")
        item["subcategory"] = summary.get("subcategory")
        item["sentiment"] = summary.get("sentiment")
        item["escalation_required"] = summary.get(
            "escalation_required"
        )
        item["escalation_level"] = summary.get(
            "escalation_level"
        )
        item["analysis_available"] = bool(summary)

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


# ============================================================
# CUSTOMER RESPONSE
# CUSTOMER ONLY — ownership + Awaiting Customer state are
# enforced in customer_respond().
# ============================================================

@app.post("/api/complaints/{complaint_id}/respond")
def respond_to_complaint(
    complaint_id: str,
    request: CustomerRespondRequest,
    current_user=Depends(require_roles("Customer"))
):
    return customer_respond(
        complaint_id=complaint_id,
        customer=current_user,
        message=request.message
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
    category: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    limit: int = 25,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    """
    Filtered, paginated complaint list for managers and admins.

    Filtering happens in MongoDB, not in the browser, so the
    counts returned describe the whole matching set.
    """

    return get_management_complaints(
        status=status,
        department=department,
        assigned_to=assigned_to,
        category=category,
        priority=priority,
        search=search,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit,
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
    """
    Report catalogue plus the headline operational figures the
    reports are built from.
    """

    catalogue = list_reports()

    return {
        **get_report_data(),
        "reports": catalogue["reports"],
        "export_formats_unavailable": catalogue[
            "export_formats_unavailable"
        ],
    }


@app.get("/api/management/reports/{report_type}")
def management_report(
    report_type: str,
    date_from: str | None = None,
    date_to: str | None = None,
    department: str | None = None,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    """Generate one SRS report from stored data."""

    try:
        return generate_report(
            report_type,
            date_from=date_from,
            date_to=date_to,
            department=department,
        )
    except UnknownReportType:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown report type '{report_type}'. "
                f"Available: {', '.join(sorted(REPORT_TYPES))}"
            ),
        )


@app.get("/api/management/reports/{report_type}/export")
def management_report_export(
    report_type: str,
    format: str = "csv",
    date_from: str | None = None,
    date_to: str | None = None,
    department: str | None = None,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    """
    Export a generated report.

    Only CSV is produced: the backend has no PDF or spreadsheet
    dependency, and a fabricated file would not be an export.
    """

    requested = (format or "csv").lower()

    if requested != "csv":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Export format '{requested}' is not available. "
                "The backend has no PDF or spreadsheet library "
                "installed, so only CSV export is supported."
            ),
        )

    try:
        report = generate_report(
            report_type,
            date_from=date_from,
            date_to=date_to,
            department=department,
        )
    except UnknownReportType:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown report type '{report_type}'. "
                f"Available: {', '.join(sorted(REPORT_TYPES))}"
            ),
        )

    filename = (
        f"supportnova-{report_type}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    )

    return StreamingResponse(
        iter([render_report_csv(report)]),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )


# ============================================================
# ANALYTICS
# Read-only aggregations. No workflow state is changed here.
# ============================================================

@app.get("/api/management/trends")
def management_trends(
    days: int = 30,
    department: str | None = None,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_complaint_trends(
        days=days,
        department=department
    )


@app.get("/api/management/department-performance")
def management_department_performance(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_department_performance()


@app.get("/api/management/resolution-statistics")
def management_resolution_statistics(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_resolution_statistics()


@app.get("/api/management/sentiment")
def management_sentiment(
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return get_sentiment_distribution()


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


@app.post("/api/admin/users", status_code=201)
def admin_create_staff_user(
    payload: StaffCreateRequest,
    current_user=Depends(
        require_roles("Admin")
    )
):
    """
    Provision a privileged account.

    Public registration always creates a Customer; Agent, Reviewer,
    Manager and Admin accounts can only be created here.
    """

    return create_staff_user(
        name=payload.name,
        email=payload.email,
        password=payload.password,
        role=payload.role,
        department=payload.department,
        status=payload.status,
        actor=current_user,
    )


@app.patch("/api/admin/users/{user_id}")
def admin_update_staff_user(
    user_id: str,
    payload: StaffUpdateRequest,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return update_staff_user(
        user_id=user_id,
        name=payload.name,
        role=payload.role,
        department=payload.department,
        status=payload.status,
        actor=current_user,
    )


@app.get("/api/admin/agents")
def admin_assignable_agents(
    department: str | None = None,
    current_user=Depends(
        require_roles("Reviewer", "Manager", "Admin")
    )
):
    """
    Active agents, optionally restricted to one department.

    Reviewers are included because the manual-review workflow lets
    them reassign a complaint to an agent: without this list the
    reviewer would have to type a raw database id, and the picker
    could not show that a department has no available agent.
    """

    return {
        "agents": get_assignable_agents(
            department=department,
        )
    }


# ============================================================
# DEPARTMENTS
#
# The department registry mirrors the routing taxonomy the
# classification engine already uses, so the frontend never has to
# hardcode department names.
# ============================================================

@app.get("/api/departments")
def list_departments(
    status: str | None = None,
    current_user=Depends(
        require_roles("Agent", "Reviewer", "Manager", "Admin")
    )
):
    return get_departments(status=status)


@app.post("/api/admin/departments", status_code=201)
def admin_create_department(
    payload: DepartmentCreateRequest,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return create_department(
        name=payload.name,
        description=payload.description,
        actor=current_user,
    )


@app.patch("/api/admin/departments/{department_id}")
def admin_update_department(
    department_id: str,
    payload: DepartmentUpdateRequest,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return update_department(
        department_id=department_id,
        name=payload.name,
        description=payload.description,
        status=payload.status,
        actor=current_user,
    )


@app.get("/api/admin/departments/{department_name}/staff")
def admin_department_staff(
    department_name: str,
    current_user=Depends(
        require_roles("Manager", "Admin")
    )
):
    return {
        "department": department_name,
        "staff": get_department_staff(department_name),
    }


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


@app.get("/api/admin/statistics")
def admin_statistics(
    current_user=Depends(
        require_roles("Admin")
    )
):
    """System-wide statistics for the administrator home."""

    return get_admin_statistics()


@app.get("/api/admin/audit")
def admin_audit_logs(
    limit: int = 50,
    page: int = 1,
    action: str | None = None,
    actor_id: str | None = None,
    actor_role: str | None = None,
    entity_type: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user=Depends(
        require_roles("Admin")
    )
):
    """
    Paginated audit log with real filters.

    Only fields the audit schema actually stores can be filtered
    on: actor, actor role, action, entity type and date.
    """

    return get_audit_logs(
        limit=limit,
        page=page,
        action=action,
        actor_id=actor_id,
        actor_role=actor_role,
        entity_type=entity_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )


@app.get("/api/admin/audit/summary")
def admin_audit_summary(
    days: int = 30,
    current_user=Depends(
        require_roles("Admin")
    )
):
    return get_audit_summary(days=days)


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
