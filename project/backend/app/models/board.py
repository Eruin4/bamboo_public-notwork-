"""
Board model - 게시판 (SCHOOL/GLOBAL).
"""
import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum, ForeignKey, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.heading import Heading
    from app.models.post import Post
    from app.models.author_alias import AuthorAlias
    from app.models.board_accessible_school import BoardAccessibleSchool
    from app.models.board_manager import BoardManager


class BoardType(str, enum.Enum):
    """게시판 유형."""
    SCHOOL = "SCHOOL"  # 학교별 게시판
    GLOBAL = "GLOBAL"  # 전체 공용 게시판
    CUSTOM = "CUSTOM"  # 커스텀 게시판 (다중 학교 접근)


class Board(Base):
    """게시판 테이블."""

    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 게시판 정보
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 유형
    board_type: Mapped[BoardType] = mapped_column(
        Enum(BoardType), nullable=False, index=True
    )
    
    # SCHOOL 타입인 경우 학교 연결
    school_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), nullable=True
    )
    
    # 상태
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hot_post_threshold: Mapped[int] = mapped_column(default=5, nullable=False)

    # Relationships
    school: Mapped[Optional["School"]] = relationship("School", back_populates="boards")
    headings: Mapped[List["Heading"]] = relationship(
        "Heading", back_populates="board", cascade="all, delete-orphan"
    )
    posts: Mapped[List["Post"]] = relationship(
        "Post", back_populates="board", cascade="all, delete-orphan"
    )
    author_aliases: Mapped[List["AuthorAlias"]] = relationship(
        "AuthorAlias", back_populates="board", cascade="all, delete-orphan"
    )
    accessible_schools: Mapped[List["BoardAccessibleSchool"]] = relationship(
        "BoardAccessibleSchool", back_populates="board", cascade="all, delete-orphan"
    )
    managers: Mapped[List["BoardManager"]] = relationship(
        "BoardManager", back_populates="board", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Board(id={self.id}, name={self.name}, type={self.board_type})>"

