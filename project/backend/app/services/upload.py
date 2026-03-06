"""
File upload service.
"""
import hashlib
import secrets
import magic
from pathlib import Path
from typing import BinaryIO

from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.file import File

# Magic number signatures for images
IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # RIFF....WEBP
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
}


def validate_image_magic(content: bytes) -> str | None:
    """
    파일 매직 넘버로 이미지 타입 검증.
    반환: MIME 타입 또는 None (유효하지 않은 경우)
    """
    # python-magic 사용
    try:
        mime = magic.from_buffer(content[:2048], mime=True)
        if mime in settings.ALLOWED_IMAGE_TYPES:
            return mime
    except Exception:
        pass

    # 매직 넘버 직접 확인
    for signature, mime_type in IMAGE_SIGNATURES.items():
        if content.startswith(signature):
            if mime_type in settings.ALLOWED_IMAGE_TYPES:
                return mime_type

    return None


def calculate_sha256(content: bytes) -> str:
    """파일 SHA256 해시 계산."""
    return hashlib.sha256(content).hexdigest()


def generate_storage_key(extension: str) -> str:
    """랜덤 저장 키 생성."""
    random_part = secrets.token_urlsafe(32)
    return f"{random_part}{extension}"


async def process_and_save_image(
    db: AsyncSession,
    user_id: int,
    file_content: bytes,
    original_name: str,
    mime_type: str,
) -> File:
    """
    이미지 처리 및 저장:
    1. 크기 검증
    2. 해상도 제한 (리사이즈)
    3. 원본 저장
    4. 썸네일 생성
    """
    # 크기 검증
    max_size = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(file_content) > max_size:
        raise ValueError(f"파일 크기는 {settings.MAX_IMAGE_SIZE_MB}MB를 초과할 수 없습니다")

    # 이미지 열기
    from io import BytesIO
    img = Image.open(BytesIO(file_content))
    original_format = img.format

    # EXIF 회전 적용
    try:
        from PIL import ExifTags
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation] == "Orientation":
                break
        exif = img._getexif()
        if exif:
            orientation_value = exif.get(orientation)
            if orientation_value == 3:
                img = img.rotate(180, expand=True)
            elif orientation_value == 6:
                img = img.rotate(270, expand=True)
            elif orientation_value == 8:
                img = img.rotate(90, expand=True)
    except (AttributeError, KeyError, IndexError):
        pass

    width, height = img.size

    # 해상도 제한 (리사이즈)
    max_resolution = settings.MAX_IMAGE_RESOLUTION
    if max(width, height) > max_resolution:
        ratio = max_resolution / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        width, height = img.size

        # 리사이즈된 이미지를 바이트로 변환
        output = BytesIO()
        save_format = original_format if original_format else "JPEG"
        if save_format == "JPEG":
            img = img.convert("RGB")  # RGBA -> RGB for JPEG
        img.save(output, format=save_format, quality=90)
        file_content = output.getvalue()

    # SHA256 계산
    sha256 = calculate_sha256(file_content)

    # 확장자 결정
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    extension = ext_map.get(mime_type, ".jpg")

    # 저장 키 생성
    storage_key = generate_storage_key(extension)
    thumb_key = f"thumb_{storage_key}"

    # 디렉토리 생성
    upload_dir = Path(settings.UPLOAD_DIR)
    thumb_dir = Path(settings.THUMB_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    # 원본 저장
    upload_path = upload_dir / storage_key
    with open(upload_path, "wb") as f:
        f.write(file_content)

    # 썸네일 생성
    thumb_size = settings.THUMB_MAX_SIZE
    thumb_img = img.copy()
    thumb_img.thumbnail((thumb_size, thumb_size), Image.Resampling.LANCZOS)

    thumb_path = thumb_dir / thumb_key
    thumb_output = BytesIO()
    save_format = "JPEG"  # 썸네일은 항상 JPEG
    if thumb_img.mode in ("RGBA", "P"):
        thumb_img = thumb_img.convert("RGB")
    thumb_img.save(thumb_output, format=save_format, quality=85)

    with open(thumb_path, "wb") as f:
        f.write(thumb_output.getvalue())

    # DB 저장
    file_record = File(
        uploader_id=user_id,
        original_name=original_name,
        mime_type=mime_type,
        size=len(file_content),
        sha256=sha256,
        storage_key=storage_key,
        thumb_key=thumb_key,
        width=width,
        height=height,
    )
    db.add(file_record)
    await db.flush()
    await db.refresh(file_record)

    return file_record


def validate_file_type(content: bytes) -> str | None:
    """
    일반 파일 타입 검증.
    반환: MIME 타입 또는 None (유효하지 않은 경우)
    """
    try:
        mime = magic.from_buffer(content[:2048], mime=True)
        if mime in settings.ALLOWED_FILE_TYPES:
            return mime
    except Exception:
        pass
    return None


async def process_and_save_file(
    db: AsyncSession,
    user_id: int,
    file_content: bytes,
    original_name: str,
    mime_type: str,
) -> File:
    """
    일반 파일 처리 및 저장 (비이미지).
    """
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(file_content) > max_size:
        raise ValueError(f"파일 크기는 {settings.MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다")

    sha256 = calculate_sha256(file_content)

    # 확장자 결정
    ext = Path(original_name).suffix.lower() or ".bin"
    storage_key = generate_storage_key(ext)

    # 디렉토리 생성
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # 파일 저장
    upload_path = upload_dir / storage_key
    with open(upload_path, "wb") as f:
        f.write(file_content)

    # DB 저장
    file_record = File(
        uploader_id=user_id,
        original_name=original_name,
        mime_type=mime_type,
        size=len(file_content),
        sha256=sha256,
        storage_key=storage_key,
        thumb_key=None,
        width=None,
        height=None,
    )
    db.add(file_record)
    await db.flush()
    await db.refresh(file_record)

    return file_record


async def delete_file_from_storage(file: File) -> None:
    """파일 및 썸네일 삭제."""
    upload_path = Path(settings.UPLOAD_DIR) / file.storage_key
    if upload_path.exists():
        upload_path.unlink()

    if file.thumb_key:
        thumb_path = Path(settings.THUMB_DIR) / file.thumb_key
        if thumb_path.exists():
            thumb_path.unlink()

