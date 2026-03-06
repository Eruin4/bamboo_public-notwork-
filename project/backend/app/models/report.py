"""
Report model - 신고.
"""
import enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ReportTargetType(str, enum.Enum):
    """신고 대상 유형."""
    POST = "POST"
    COMMENT = "COMMENT"


class ReportStatus(str, enum.Enum):
    """신고 처리 상태."""
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Report(Base):
    """신고 테이블."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 신고자
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 신고 대상
    target_type: Mapped[ReportTargetType] = mapped_column(
        Enum(ReportTargetType), nullable=False
    )
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # 게시판 연결 (게시판별 신고 관리용)
    board_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=True, index=True
    )
    
    # 신고 내용
    reason: Mapped[str] = mapped_column(String(50), nullable=False)  # 카테고리
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # 상세 설명
    
    # 처리 상태
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus), default=ReportStatus.PENDING, nullable=False
    )
    
    # 처리자
    resolved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    reporter: Mapped["User"] = relationship(
        "User", foreign_keys=[reporter_id], back_populates="reports_made"
    )
    resolved_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[resolved_by_id]
    )

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, type={self.target_type}, target={self.target_id})>"

