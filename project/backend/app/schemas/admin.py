"""
Admin schemas.
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """감사 로그 응답."""
    id: int
    admin_id: int
    admin_email: str | None = None
    action: str
    target_type: str
    target_id: int
    details: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """감사 로그 목록 응답."""
    logs: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


class SchoolAdminResponse(BaseModel):
    """학교 정보 응답 (관리자용)."""
    id: int
    name: str
    short_name: str
    allowed_domains: list[str]
    description: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SchoolListResponse(BaseModel):
    """학교 목록 응답 (관리자용)."""
    schools: list[SchoolAdminResponse]
    total: int
    page: int
    page_size: int


class SchoolCreate(BaseModel):
    """학교 생성 요청 (관리자용)."""
    name: str
    short_name: str
    allowed_domains: list[str]
    description: str | None = None
    is_active: bool = True


class SchoolUpdate(BaseModel):
    """학교 정보 수정 요청 (관리자용)."""
    short_name: str | None = None
    is_active: bool | None = None
    allowed_domains: list[str] | None = None


