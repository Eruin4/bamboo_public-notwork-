"""
Domain request schemas.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class DomainRequestCreate(BaseModel):
    """도메인 지원 요청 생성."""
    school_name: str = Field(..., min_length=2, max_length=100)
    school_short_name: str = Field(..., min_length=1, max_length=20)
    email_domain: str = Field(..., min_length=3, max_length=100)
    description: str | None = Field(None, max_length=500)


class DomainRequestResponse(BaseModel):
    """도메인 지원 요청 응답."""
    id: int
    requester_id: int
    requester_email: str | None = None
    school_name: str
    school_short_name: str
    email_domain: str
    description: str | None
    status: str
    admin_note: str | None
    resolved_by_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class DomainRequestListResponse(BaseModel):
    """도메인 지원 요청 목록 응답."""
    requests: list[DomainRequestResponse]
    total: int
    page: int
    page_size: int


class DomainRequestResolve(BaseModel):
    """도메인 요청 승인/거절."""
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    admin_note: str | None = Field(None, max_length=500)

