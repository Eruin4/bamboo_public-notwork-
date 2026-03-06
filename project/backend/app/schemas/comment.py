"""
Comment schemas.
"""
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.post import AuthorInfo


class CommentCreate(BaseModel):
    """댓글 생성 요청."""
    body: str = Field(..., min_length=1, max_length=2000)
    parent_id: int | None = None
    use_nickname: bool = False  # 닉네임 공개 여부


class CommentResponse(BaseModel):
    """댓글 응답."""
    id: int
    post_id: int
    parent_id: int | None
    body: str
    author: AuthorInfo
    is_hidden: bool
    is_deleted: bool
    like_count: int = 0
    dislike_count: int = 0
    my_vote: str | None = None  # "LIKE", "DISLIKE", or None
    can_delete: bool = False    # 삭제 권한 여부
    created_at: datetime
    replies: list["CommentResponse"] = []

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    """댓글 목록 응답."""
    comments: list[CommentResponse]
    total: int


class MyCommentItem(BaseModel):
    """내가 쓴 댓글 아이템."""
    id: int
    post_id: int
    post_title: str | None = None
    board_id: int | None = None
    board_name: str | None = None
    body: str
    like_count: int = 0
    dislike_count: int = 0
    created_at: datetime


class MyCommentListResponse(BaseModel):
    """내가 쓴 댓글 목록 응답."""
    comments: list[MyCommentItem]
    total: int
    page: int
    page_size: int
    total_pages: int

