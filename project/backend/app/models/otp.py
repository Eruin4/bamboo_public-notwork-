"""
OTPCode model - 이메일 인증 OTP 코드.
"""
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class OTPCode(Base):
    """OTP 코드 테이블."""

    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 사용자
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 대상 이메일
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    
    # OTP 코드 (6자리)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    
    # 만료 시간
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # 사용 여부
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 시도 횟수 (브루트포스 방지)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<OTPCode(id={self.id}, email={self.email})>"

    @property
    def is_expired(self) -> bool:
        """만료 여부 확인."""
        return datetime.now(self.expires_at.tzinfo) > self.expires_at

    @property
    def is_valid(self) -> bool:
        """유효성 확인 (미사용 & 미만료 & 시도횟수 미초과)."""
        return not self.is_used and not self.is_expired and self.attempts < 5

