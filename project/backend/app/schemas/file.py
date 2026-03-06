"""
File upload schemas.
"""
from datetime import datetime

from pydantic import BaseModel


class UploadResponse(BaseModel):
    """업로드 응답."""
    id: int
    original_name: str
    mime_type: str
    size: int
    storage_key: str
    thumb_key: str | None
    width: int | None
    height: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class UploadListResponse(BaseModel):
    """업로드 목록 응답."""
    files: list[UploadResponse]

