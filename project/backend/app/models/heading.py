"""
Heading model - 게시판 내 글머리/카테고리.
"""
from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board import Board
    from app.models.post import Post


class Heading(Base):
    """글머리(카테고리) 테이블."""

    __tablename__ = "headings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 게시판 연결
    board_id: Mapped[int] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 글머리 정보
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6B7280", nullable=False)  # HEX color
    
    # 정렬 순서
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 상태
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    board: Mapped["Board"] = relationship("Board", back_populates="headings")
    posts: Mapped[List["Post"]] = relationship("Post", back_populates="heading")

    def __repr__(self) -> str:
        return f"<Heading(id={self.id}, name={self.name})>"

