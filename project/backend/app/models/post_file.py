"""
PostFile model - 게시글과 파일의 N:M 연결.
"""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.post import Post
    from app.models.file import File


class PostFile(Base):
    """게시글-파일 연결 테이블."""

    __tablename__ = "post_files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 게시글 연결
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 파일 연결
    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 순서 (게시글 내 파일 순서)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    post: Mapped["Post"] = relationship("Post", back_populates="post_files")
    file: Mapped["File"] = relationship("File", back_populates="post_files")

    def __repr__(self) -> str:
        return f"<PostFile(post_id={self.post_id}, file_id={self.file_id})>"

