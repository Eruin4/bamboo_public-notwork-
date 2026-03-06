"""
User model - 사용자 계정 및 인증 정보.
"""
import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.post import Post
    from app.models.comment import Comment
    from app.models.author_alias import AuthorAlias
    from app.models.report import Report


class UserRole(str, enum.Enum):
    """사용자 역할."""
    USER = "USER"
    ADMIN = "ADMIN"


class User(Base):
    """사용자 테이블."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 인증 정보
    personal_email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # 학교 이메일 인증
    school_email: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    school_email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    
    # 학교 연결
    school_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("schools.id", ondelete="SET NULL"), nullable=True
    )
    
    # 역할 및 상태
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.USER, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # 프로필 (선택)
    nickname: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    school: Mapped[Optional["School"]] = relationship("School", back_populates="users")
    posts: Mapped[List["Post"]] = relationship("Post", back_populates="author")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="author")
    author_aliases: Mapped[List["AuthorAlias"]] = relationship(
        "AuthorAlias", back_populates="user"
    )
    reports_made: Mapped[List["Report"]] = relationship(
        "Report", foreign_keys="[Report.reporter_id]", back_populates="reporter"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.personal_email})>"

    @property
    def is_verified(self) -> bool:
        """학교 이메일 인증 완료 여부."""
        return self.school_email_verified and self.school_id is not None

    @property
    def is_admin(self) -> bool:
        """관리자 여부."""
        return self.role == UserRole.ADMIN

