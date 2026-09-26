from typing import Optional
from pydantic import BaseModel, EmailStr


class ComplaintCreate(BaseModel):
    title: str
    description: str

    order_id: Optional[str] = None
    transaction_id: Optional[str] = None
    product: Optional[str] = None
    amount: Optional[str] = None
    date: Optional[str] = None


class ComplaintResponse(BaseModel):
    id: str
    title: str
    description: str

    # -------------------------
# Authentication Schemas
# -------------------------

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ComplaintAssignmentRequest(BaseModel):
    agent_id: str

# -------------------------
# Reviewer Schemas
# -------------------------

class ReviewCommentRequest(BaseModel):
    comment: str


class ReviewModifyRequest(BaseModel):
    comment: str
    customer_response: Optional[str] = None
    agent_guidance: Optional[str] = None


class ReviewReclassifyRequest(BaseModel):
    category: str
    subcategory: str
    department: str
    comment: str


class ReviewReassignRequest(BaseModel):
    agent_id: str
    comment: str


class ReviewActionRequest(BaseModel):
    comment: Optional[str] = None




class AgentCommentRequest(BaseModel):
    comment: str


class AgentResolveRequest(BaseModel):
    comment: str


class AgentEscalateRequest(BaseModel):
    comment: str


class UserStatusRequest(BaseModel):
    status: str
