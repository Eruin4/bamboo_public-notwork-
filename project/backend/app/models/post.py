"""
Post model - 게시글.
"""
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board import Board
    from app.models.heading import Heading
    from app.models.user import User
    from app.models.comment import Comment
    from app.models.post_file import PostFile
    from app.models.vote import PostVote


class Post(Base):
    """게시글 테이블."""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 게시판/글머리 연결
    board_id: Mapped[int] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    heading_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("headings.id", ondelete="SET NULL"), nullable=True
    )
    
    # 작성자
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 게시글 내용
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 작성자 닉네임 (닉네임 공개 선택 시 저장)
    nickname: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # 상태
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_notice: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 통계
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dislike_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    board: Mapped["Board"] = relationship("Board", back_populates="posts")
    heading: Mapped[Optional["Heading"]] = relationship("Heading", back_populates="posts")
    author: Mapped["User"] = relationship("User", back_populates="posts")
    comments: Mapped[List["Comment"]] = relationship(
        "Comment", back_populates="post", cascade="all, delete-orphan"
    )
    post_files: Mapped[List["PostFile"]] = relationship(
        "PostFile", back_populates="post", cascade="all, delete-orphan"
    )
    votes: Mapped[List["PostVote"]] = relationship(
        "PostVote", back_populates="post", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Post(id={self.id}, title={self.title[:20]})>"

