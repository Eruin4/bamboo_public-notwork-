"""
BoardManager model - 게시판 관리자 (커스텀 게시판).
"""
import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.board import Board


class ManagerRole(str, enum.Enum):
    """게시판 관리자 역할."""
    OWNER = "OWNER"          # 관리자 (게시판 생성자)
    SUB_MANAGER = "SUB_MANAGER"  # 부관리자


class BoardManager(Base):
    """게시판 관리자 테이블."""

    __tablename__ = "board_managers"
    __table_args__ = (
        UniqueConstraint("board_id", "user_id", name="uq_board_manager"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    board_id: Mapped[int] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ManagerRole.OWNER.value
    )

    # Relationships
    board: Mapped["Board"] = relationship("Board", back_populates="managers")
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<BoardManager(board_id={self.board_id}, user_id={self.user_id}, role={self.role})>"
