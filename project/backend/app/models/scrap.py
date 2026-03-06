"""
Scrap model - 게시글 스크랩(즐겨찾기).
"""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.post import Post
    from app.models.user import User


class Scrap(Base):
    """게시글 스크랩 테이블."""

    __tablename__ = "scraps"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_scrap_user_post"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    post: Mapped["Post"] = relationship("Post")

    def __repr__(self) -> str:
        return f"<Scrap(user={self.user_id}, post={self.post_id})>"
