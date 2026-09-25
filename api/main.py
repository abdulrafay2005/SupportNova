import sys
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId


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
    users_collection
)


# ============================================================
# SCHEMAS
# ============================================================

from api.schemas import (
    ComplaintCreate,
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    UserResponse
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
# EXISTING ML / AI PIPELINE
# IMPORTANT:
# Do not replace these with different function names.
# ============================================================

from rule_engine import analyze_complaint
from genai import analyze_with_ai


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
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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
def get_complaints(
    current_user=Depends(get_current_user)
):

    role = current_user["role"]

    # --------------------------------------------------------
    # CUSTOMER
    # --------------------------------------------------------

    if role == "Customer":

        query = {
            "user_id": current_user["id"]
        }

    # --------------------------------------------------------
    # STAFF
    # --------------------------------------------------------

    elif role in {
        "Agent",
        "Reviewer",
        "Manager",
        "Admin"
    }:

        query = {}

    # --------------------------------------------------------
    # UNKNOWN ROLE
    # --------------------------------------------------------

    else:

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access complaints"
        )

    complaints = []

    for complaint in complaints_collection.find(
        query
    ).sort(
        "created_at",
        -1
    ):

        complaints.append({

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