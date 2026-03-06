"""
Report schemas.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    """신고 생성 요청."""
    target_type: str = Field(..., pattern=r"^(POST|COMMENT)$")
    target_id: int
    reason: str | None = Field(None, max_length=50)
    description: str | None = Field(None, max_length=500)


class ReportResponse(BaseModel):
    """신고 응답."""
    id: int
    reporter_id: int
    target_type: str
    target_id: int
    board_id: int | None
    reason: str
    description: str | None
    status: str
    resolved_by_id: int | None
    resolution_note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    """신고 목록 응답."""
    reports: list[ReportResponse]
    total: int
    page: int
    page_size: int


class ReportResolve(BaseModel):
    """신고 처리 요청."""
    status: str = Field(..., pattern=r"^(REVIEWED|RESOLVED|DISMISSED)$")
    resolution_note: str | None = Field(None, max_length=500)

