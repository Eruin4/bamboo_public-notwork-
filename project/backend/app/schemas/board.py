"""
Board and Heading schemas.
"""
from pydantic import BaseModel, Field


class HeadingResponse(BaseModel):
    """글머리 응답."""
    id: int
    name: str
    color: str
    sort_order: int

    class Config:
        from_attributes = True


class HeadingCreate(BaseModel):
    """글머리 생성 요청."""
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(default="#6B7280", pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: int = Field(default=0, ge=0)


class BoardResponse(BaseModel):
    """게시판 응답."""
    id: int
    name: str
    description: str | None
    board_type: str
    school_id: int | None
    school_name: str | None = None
    hot_post_threshold: int = 5
    is_manager: bool = False
    headings: list[HeadingResponse] = []

    class Config:
        from_attributes = True


class BoardListResponse(BaseModel):
    """게시판 목록 응답."""
    boards: list[BoardResponse]

