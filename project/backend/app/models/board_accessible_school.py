"""
BoardAccessibleSchool model - 게시판별 접근 가능 학교 매핑.
"""
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BoardAccessibleSchool(Base):
    """게시판-학교 접근 매핑 테이블."""

    __tablename__ = "board_accessible_schools"
    __table_args__ = (
        UniqueConstraint("board_id", "school_id", name="uq_board_school"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    board_id: Mapped[int] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    board = relationship("Board", back_populates="accessible_schools")
    school = relationship("School")
