"""
DomainRequest model - 도메인 지원 요청.
"""
import enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class DomainRequestStatus(str, enum.Enum):
    """도메인 요청 상태."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DomainRequest(Base):
    """도메인 지원 요청 테이블."""

    __tablename__ = "domain_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 요청자
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 학교 정보
    school_name: Mapped[str] = mapped_column(String(100), nullable=False)
    school_short_name: Mapped[str] = mapped_column(String(20), nullable=False)
    email_domain: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 처리 상태
    status: Mapped[DomainRequestStatus] = mapped_column(
        Enum(DomainRequestStatus), default=DomainRequestStatus.PENDING, nullable=False
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
        return f"<DomainRequest(id={self.id}, school={self.school_name}, domain={self.email_domain})>"

