"""
Board request and board management schemas.
"""
from datetime import datetime
from pydantic import BaseModel, Field


# ── Board Request Schemas ──

class BoardRequestCreate(BaseModel):
    """게시판 생성 신청."""
    board_name: str = Field(..., min_length=1, max_length=100)
    board_description: str | None = None
    school_ids: list[int] = Field(..., min_length=1)


class BoardRequestResponse(BaseModel):
    """게시판 신청 응답."""
    id: int
    requester_id: int
    requester_email: str | None = None
    requester_school_name: str | None = None
    board_name: str
    board_description: str | None
    school_ids: list[int]
    school_names: list[str] = []
    status: str
    admin_note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class BoardRequestResolve(BaseModel):
    """게시판 신청 처리 (관리자)."""
    action: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    admin_note: str | None = None


# ── Board Management Schemas ──

class BoardSchoolAdd(BaseModel):
    """게시판에 학교 추가 (게시판 관리자)."""
    school_id: int


class BoardSchoolRemove(BaseModel):
    """게시판에서 학교 제거 (게시판 관리자)."""
    school_id: int


class SubManagerAdd(BaseModel):
    """부관리자 임명."""
    user_id: int


class BoardManageUpdate(BaseModel):
    """게시판 정보 수정."""
    description: str | None = None
    hot_post_threshold: int | None = Field(default=None, ge=1, le=100)


class BoardManageResponse(BaseModel):
    """게시판 관리 정보 응답."""
    id: int
    name: str
    description: str | None
    board_type: str
    is_active: bool
    hot_post_threshold: int
    accessible_schools: list[dict] = []  # [{id, name, short_name}]
    managers: list[dict] = []  # [{user_id, email, role}]
    owner_school_id: int | None = None  # 관리자의 학교 ID
    my_role: str | None = None  # 현재 사용자의 역할 (OWNER / SUB_MANAGER / None)
    created_at: datetime

    class Config:
        from_attributes = True
