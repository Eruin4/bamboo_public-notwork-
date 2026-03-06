"""
Con models - 콘(이모티콘) 시스템.
"""
import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.file import File


class ConPackStatus(str, enum.Enum):
    """콘무리 상태."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ConPack(Base):
    """콘무리 (이모티콘 묶음) 테이블."""

    __tablename__ = "con_packs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 신청자
    uploader_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 콘무리 정보
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 상태
    status: Mapped[ConPackStatus] = mapped_column(
        Enum(ConPackStatus), default=ConPackStatus.PENDING, nullable=False, index=True
    )

    # 관리자 메모
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 처리자
    resolved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploader_id])
    resolved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[resolved_by_id])
    items: Mapped[List["ConItem"]] = relationship(
        "ConItem", back_populates="pack", cascade="all, delete-orphan", order_by="ConItem.sort_order"
    )

    def __repr__(self) -> str:
        return f"<ConPack(id={self.id}, name={self.name}, status={self.status})>"


class ConItem(Base):
    """개별 콘 (이모티콘) 테이블."""

    __tablename__ = "con_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 소속 콘무리
    pack_id: Mapped[int] = mapped_column(
        ForeignKey("con_packs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 이미지 파일 (100x100)
    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )

    # 콘 이름 (선택)
    name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # 순서
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    pack: Mapped["ConPack"] = relationship("ConPack", back_populates="items")
    file: Mapped["File"] = relationship("File")

    def __repr__(self) -> str:
        return f"<ConItem(id={self.id}, pack_id={self.pack_id})>"


class UserConPack(Base):
    """사용자 콘무리 보관함 테이블."""

    __tablename__ = "user_con_packs"
    __table_args__ = (
        UniqueConstraint("user_id", "pack_id", name="uq_user_con_pack"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pack_id: Mapped[int] = mapped_column(
        ForeignKey("con_packs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    pack: Mapped["ConPack"] = relationship("ConPack")

    def __repr__(self) -> str:
        return f"<UserConPack(user_id={self.user_id}, pack_id={self.pack_id})>"
