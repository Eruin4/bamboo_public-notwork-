"""
School model - 학교 정보 및 허용 도메인 관리.
"""
from typing import TYPE_CHECKING, List

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.board import Board


class School(Base):
    """학교 테이블."""

    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 학교 정보
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    short_name: Mapped[str] = mapped_column(String(20), nullable=False)  # 약칭 (예: "한과영")
    
    # 허용 이메일 도메인 (예: ["hana.hs.kr", "student.hana.hs.kr"])
    allowed_domains: Mapped[List[str]] = mapped_column(
        ARRAY(String(100)),
        nullable=False,
        default=list,
    )
    
    # 학교 설명 (선택)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # 활성화 여부
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="school")
    boards: Mapped[List["Board"]] = relationship("Board", back_populates="school")

    def __repr__(self) -> str:
        return f"<School(id={self.id}, name={self.name})>"

    def is_email_allowed(self, email: str) -> bool:
        """이메일 도메인이 허용 목록에 있는지 확인."""
        if not email or "@" not in email:
            return False
        domain = email.split("@")[1].lower()
        return any(
            domain == allowed.lower() or domain.endswith(f".{allowed.lower()}")
            for allowed in self.allowed_domains
        )

