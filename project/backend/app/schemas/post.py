"""
Post schemas.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """파일 정보."""
    id: int
    original_name: str
    mime_type: str
    size: int
    storage_key: str
    thumb_key: str | None
    width: int | None
    height: int | None

    class Config:
        from_attributes = True


class AuthorInfo(BaseModel):
    """작성자 정보 (익명)."""
    anon_number: int | None = None
    school_name: str | None = None
    nickname: str | None = None  # 닉네임 공개 시 표시
    is_author: bool = False  # 현재 사용자가 작성자인지
    is_post_author: bool = False  # (댓글용) 게시글 작성자인지


class PostCreate(BaseModel):
    """게시글 생성 요청."""
    heading_id: int | None = None
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=10000)
    attached_file_ids: list[int] = Field(default_factory=list, max_length=10)
    use_nickname: bool = False  # 닉네임 공개 여부
    is_notice: bool = False  # 공지사항 여부


class PostResponse(BaseModel):
    """게시글 응답."""
    id: int
    board_id: int
    heading_id: int | None
    heading_name: str | None = None
    heading_color: str | None = None
    title: str
    body: str
    author: AuthorInfo
    is_pinned: bool
    is_notice: bool
    is_hidden: bool
    view_count: int
    comment_count: int
    like_count: int = 0
    dislike_count: int = 0
    my_vote: str | None = None  # "LIKE", "DISLIKE", or None
    my_scrap: bool = False  # 스크랩 여부
    is_manager: bool = False  # 게시판 관리자 여부(삭제/관리 권한)
    files: list[FileInfo] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostListItem(BaseModel):
    """게시글 목록 아이템."""
    id: int
    board_id: int | None = None
    board_name: str | None = None
    heading_id: int | None
    heading_name: str | None = None
    heading_color: str | None = None
    title: str
    author: AuthorInfo
    is_pinned: bool
    is_notice: bool
    view_count: int
    comment_count: int
    like_count: int = 0
    dislike_count: int = 0
    has_attachment: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    """게시글 목록 응답."""
    posts: list[PostListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class PinRequest(BaseModel):
    """고정/공지 요청."""
    is_pinned: bool = False
    is_notice: bool = False


class VoteRequest(BaseModel):
    """투표 요청."""
    vote_type: str = Field(..., pattern="^(LIKE|DISLIKE)$")  # "LIKE" or "DISLIKE"


class VoteResponse(BaseModel):
    """투표 응답."""
    like_count: int
    dislike_count: int
    my_vote: str | None = None

