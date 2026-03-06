"""
Comment model - 댓글.
"""
from typing import TYPE_CHECKING, Optional

from typing import List

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.post import Post
    from app.models.user import User
    from app.models.vote import CommentVote


class Comment(Base):
    """댓글 테이블."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 게시글 연결
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 작성자
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 대댓글 (부모 댓글)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    
    # 작성자 닉네임 (닉네임 공개 선택 시 저장)
    nickname: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # 댓글 내용
    body: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 상태
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 통계
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dislike_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 순서 (같은 게시글 내 댓글 순서)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    post: Mapped["Post"] = relationship("Post", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment", remote_side="Comment.id", backref="replies"
    )
    votes: Mapped[List["CommentVote"]] = relationship(
        "CommentVote", back_populates="comment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Comment(id={self.id}, post_id={self.post_id})>"

