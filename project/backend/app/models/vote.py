"""
Vote models - 게시글/댓글 좋아요·싫어요.
"""
import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.post import Post
    from app.models.comment import Comment
    from app.models.user import User


class VoteType(str, enum.Enum):
    """투표 종류."""
    LIKE = "LIKE"
    DISLIKE = "DISLIKE"


class PostVote(Base):
    """게시글 투표 테이블."""

    __tablename__ = "post_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_post_vote_user_post"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type: Mapped[VoteType] = mapped_column(
        Enum(VoteType, name="vote_type_enum"), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    post: Mapped["Post"] = relationship("Post", back_populates="votes")

    def __repr__(self) -> str:
        return f"<PostVote(user={self.user_id}, post={self.post_id}, type={self.vote_type})>"


class CommentVote(Base):
    """댓글 투표 테이블."""

    __tablename__ = "comment_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_comment_vote_user_comment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type: Mapped[VoteType] = mapped_column(
        Enum(VoteType, name="vote_type_enum"), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    comment: Mapped["Comment"] = relationship("Comment", back_populates="votes")

    def __repr__(self) -> str:
        return f"<CommentVote(user={self.user_id}, comment={self.comment_id}, type={self.vote_type})>"

