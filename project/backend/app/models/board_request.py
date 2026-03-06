"""
BoardRequest model - 게시판 생성 신청.
"""
import enum
from typing import TYPE_CHECKING, Optional, List

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class BoardRequestStatus(str, enum.Enum):
    """게시판 신청 상태."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class BoardRequest(Base):
    """게시판 생성 신청 테이블."""

    __tablename__ = "board_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 신청자
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 게시판 정보
    board_name: Mapped[str] = mapped_column(String(100), nullable=False)
    board_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 접근 허용할 학교 ID 목록
    school_ids: Mapped[List[int]] = mapped_column(
        ARRAY(Integer), nullable=False, default=list
    )

    # 처리 상태
    status: Mapped[BoardRequestStatus] = mapped_column(
        Enum(BoardRequestStatus), default=BoardRequestStatus.PENDING, nullable=False
    )

    # 관리자 메모
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 처리자
    resolved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    requester: Mapped["User"] = relationship(
        "User", foreign_keys=[requester_id]
    )
    resolved_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[resolved_by_id]
    )

    def __repr__(self) -> str:
        return f"<BoardRequest(id={self.id}, name={self.board_name}, status={self.status})>"
