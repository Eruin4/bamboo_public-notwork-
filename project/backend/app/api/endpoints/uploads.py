"""
Upload endpoints.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.core.deps import DbSession, VerifiedUser
from app.core.config import settings
from app.schemas.file import UploadResponse
from app.services.upload import (
    validate_image_magic,
    validate_file_type,
    process_and_save_image,
    process_and_save_file,
)

router = APIRouter()


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: VerifiedUser = None,
):
    """
    파일 업로드.
    
    - 이미지: jpg, png, webp (최대 5MB, 해상도 초과 시 리사이즈, 썸네일 생성)
    - 일반 파일: pdf, doc, xls, ppt, zip, hwp, txt 등 (최대 10MB)
    """
    # 파일 크기 검증 (일반 파일 기준 MAX_FILE_SIZE_MB)
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일 크기는 {settings.MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다",
        )

    # 파일 읽기
    content = await file.read()

    try:
        # 이미지인지 먼저 확인
        image_mime = validate_image_magic(content)
        if image_mime:
            file_record = await process_and_save_image(
                db=db,
                user_id=current_user.id,
                file_content=content,
                original_name=file.filename or "image",
                mime_type=image_mime,
            )
        else:
            # 일반 파일 타입 확인
            file_mime = validate_file_type(content)
            if not file_mime:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="지원하지 않는 파일 형식입니다",
                )
            file_record = await process_and_save_file(
                db=db,
                user_id=current_user.id,
                file_content=content,
                original_name=file.filename or "file",
                mime_type=file_mime,
            )

        return UploadResponse(
            id=file_record.id,
            original_name=file_record.original_name,
            mime_type=file_record.mime_type,
            size=file_record.size,
            storage_key=file_record.storage_key,
            thumb_key=file_record.thumb_key,
            width=file_record.width,
            height=file_record.height,
            created_at=file_record.created_at,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="파일 업로드 중 오류가 발생했습니다",
        )


@router.get("/{file_id}", response_model=UploadResponse)
async def get_file_info(file_id: int, db: DbSession, current_user: VerifiedUser):
    """파일 메타 정보 조회."""
    from sqlalchemy import select
    from app.models.file import File as FileModel

    result = await db.execute(
        select(FileModel).where(
            FileModel.id == file_id,
            FileModel.is_active == True,  # noqa: E712
        )
    )
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다",
        )

    return UploadResponse(
        id=file_record.id,
        original_name=file_record.original_name,
        mime_type=file_record.mime_type,
        size=file_record.size,
        storage_key=file_record.storage_key,
        thumb_key=file_record.thumb_key,
        width=file_record.width,
        height=file_record.height,
        created_at=file_record.created_at,
    )

