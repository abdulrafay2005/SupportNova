from typing import Optional
from pydantic import BaseModel


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