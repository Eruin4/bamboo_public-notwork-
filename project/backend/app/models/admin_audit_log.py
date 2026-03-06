"""
AdminAuditLog model - 관리자 행동 로그.
"""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AdminAuditLog(Base):
    """관리자 행동 로그 테이블."""

    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 행동한 관리자
    admin_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 행동 정보
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # 예: DELETE_POST, HIDE_COMMENT, BAN_USER, CREATE_HEADING, PIN_POST
    
    # 대상 정보
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # 예: POST, COMMENT, USER, HEADING
    target_id: Mapped[int] = mapped_column(nullable=False)
    
    # 상세 정보 (JSON)
    details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # 예: {"previous_state": {...}, "new_state": {...}, "reason": "..."}
    
    # IP 주소
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # Relationships
    admin: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<AdminAuditLog(id={self.id}, action={self.action})>"

