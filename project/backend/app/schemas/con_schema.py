"""
Con schemas - 콘(이모티콘) 시스템.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── 콘 아이템 ──────────────────────────
class ConItemResponse(BaseModel):
    """개별 콘 응답."""
    id: int
    pack_id: int
    name: Optional[str]
    sort_order: int
    image_url: str  # 렌더링용 URL

    class Config:
        from_attributes = True


class ConItemMeta(BaseModel):
    """콘 ID → 이미지 URL 매핑 (배치 조회용)."""
    id: int
    image_url: str


# ── 콘무리 ──────────────────────────────
class ConPackCreate(BaseModel):
    """콘무리 업로드 신청."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    # 업로드된 file_id 목록 (순서대로 콘 아이템이 됨)
    file_ids: List[int] = Field(..., min_length=1, max_length=50)


class ConPackResponse(BaseModel):
    """콘무리 응답."""
    id: int
    name: str
    description: Optional[str]
    status: str
    uploader_id: int
    admin_note: Optional[str]
    item_count: int
    thumbnail_url: Optional[str]  # 첫 번째 콘 이미지 URL
    created_at: datetime

    class Config:
        from_attributes = True


class ConPackDetailResponse(ConPackResponse):
    """콘무리 상세 (아이템 포함)."""
    items: List[ConItemResponse]


class ConPackListResponse(BaseModel):
    """콘무리 목록."""
    packs: List[ConPackResponse]
    total: int
    page: int
    page_size: int


# ── 관리자 ──────────────────────────────
class ConPackResolve(BaseModel):
    """콘무리 신청 승인/거절."""
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    admin_note: Optional[str] = Field(None, max_length=500)


# ── 사용자 보관함 ────────────────────────
class MyConPackResponse(BaseModel):
    """내 보관함의 콘무리 (아이템 포함)."""
    id: int
    name: str
    thumbnail_url: Optional[str]
    items: List[ConItemResponse]
