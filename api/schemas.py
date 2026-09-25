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