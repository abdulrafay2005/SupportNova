from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class ComplaintCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20_000)

    @field_validator("title", "description")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

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
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)

    @field_validator("name")
    @classmethod
    def reject_blank_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


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


class CustomerRespondRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)

    @field_validator("message")
    @classmethod
    def reject_blank_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class UserStatusRequest(BaseModel):
    status: str
