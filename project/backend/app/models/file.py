"""
File model - 업로드된 파일 메타데이터.
"""
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.post_file import PostFile


class File(Base):
    """파일 메타데이터 테이블."""

    __tablename__ = "files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 업로더
    uploader_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 원본 파일 정보
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)  # bytes
    
    # 무결성 검증
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    
    # 저장 정보
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    thumb_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # 이미지 메타 (이미지인 경우)
    width: Mapped[Optional[int]] = mapped_column(nullable=True)
    height: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    # 상태
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    uploader: Mapped["User"] = relationship("User")
    post_files: Mapped[List["PostFile"]] = relationship(
        "PostFile", back_populates="file", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<File(id={self.id}, name={self.original_name})>"

    @property
    def is_image(self) -> bool:
        """이미지 파일 여부."""
        return self.mime_type.startswith("image/")

