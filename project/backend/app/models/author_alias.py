"""
AuthorAlias model - 게시판별 익명 번호 관리.

익명 번호 규칙:
- 보드 단위로 번호가 부여됨
- 사용자가 해당 보드에서 첫 '댓글'을 작성할 때 번호 발급
- 게시글 작성만으로는 번호가 발급되지 않음
"""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board import Board
    from app.models.user import User


class AuthorAlias(Base):
    """익명 번호 테이블."""

    __tablename__ = "author_aliases"
    __table_args__ = (
        # 한 보드에서 한 사용자는 하나의 익명 번호만 가짐
        UniqueConstraint("board_id", "user_id", name="uq_author_alias_board_user"),
        # 한 보드에서 익명 번호는 유일함
        UniqueConstraint("board_id", "anon_number", name="uq_author_alias_board_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 게시판 연결
    board_id: Mapped[int] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 사용자 연결
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 익명 번호 (1부터 시작, 보드 내에서 유일)
    anon_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    board: Mapped["Board"] = relationship("Board", back_populates="author_aliases")
    user: Mapped["User"] = relationship("User", back_populates="author_aliases")

    def __repr__(self) -> str:
        return f"<AuthorAlias(board_id={self.board_id}, user_id={self.user_id}, anon={self.anon_number})>"

