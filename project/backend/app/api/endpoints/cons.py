"""
Con (이모티콘) endpoints.
"""
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import AdminUser, DbSession, VerifiedUser, get_client_ip
from app.models.board import Board, BoardType
from app.models.board_manager import BoardManager
from app.models.con_model import ConItem, ConPack, ConPackStatus, UserConPack
from app.models.file import File as FileModel
from app.schemas.auth import MessageResponse
from app.schemas.con_schema import (
    ConItemMeta,
    ConItemResponse,
    ConPackDetailResponse,
    ConPackListResponse,
    ConPackResponse,
    ConPackResolve,
    MyConPackResponse,
)
from app.services.audit import log_admin_action
from app.services.upload import (
    calculate_sha256,
    generate_storage_key,
    validate_image_magic,
)

router = APIRouter()

CON_SIZE = 100  # 콘은 반드시 100x100


def _file_url(storage_key: str) -> str:
    """파일 URL 생성."""
    return f"/uploads/{storage_key}"


def _pack_to_response(pack: ConPack) -> ConPackResponse:
    thumbnail_url = None
    if pack.items:
        thumbnail_url = _file_url(pack.items[0].file.storage_key)
    return ConPackResponse(
        id=pack.id,
        name=pack.name,
        description=pack.description,
        status=pack.status.value,
        uploader_id=pack.uploader_id,
        admin_note=pack.admin_note,
        item_count=len(pack.items),
        thumbnail_url=thumbnail_url,
        created_at=pack.created_at,
    )


def _item_to_response(item: ConItem) -> ConItemResponse:
    return ConItemResponse(
        id=item.id,
        pack_id=item.pack_id,
        name=item.name,
        sort_order=item.sort_order,
        image_url=_file_url(item.file.storage_key),
    )


async def _load_pack(db, pack_id: int, with_items: bool = True) -> ConPack:
    opts = [selectinload(ConPack.uploader)]
    if with_items:
        opts.append(
            selectinload(ConPack.items).selectinload(ConItem.file)
        )
    result = await db.execute(
        select(ConPack).where(ConPack.id == pack_id).options(*opts)
    )
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="콘무리를 찾을 수 없습니다")
    return pack


async def _is_global_board_manager(db, user) -> bool:
    """전체(GLOBAL) 게시판의 관리자 또는 부관리자 여부."""
    if user.role == "ADMIN":
        return True
    result = await db.execute(
        select(BoardManager)
        .join(Board, Board.id == BoardManager.board_id)
        .where(
            Board.board_type == BoardType.GLOBAL,
            BoardManager.user_id == user.id,
        )
    )
    return result.scalar_one_or_none() is not None


# ═══════════════════════════════════════════
# 콘 이미지 업로드 (개별)
# ═══════════════════════════════════════════

@router.post(
    "/cons/upload-image",
    summary="콘 이미지 단일 업로드 (100x100 검증)",
    status_code=status.HTTP_201_CREATED,
)
async def upload_con_image(
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: VerifiedUser = None,
):
    """
    콘 이미지 한 장을 업로드합니다.
    - 반드시 이미지 파일이어야 합니다.
    - 이미지를 100x100 으로 자동 리사이즈합니다.
    - 업로드 성공 시 file_id를 반환합니다. (콘무리 신청 시 file_ids로 사용)
    """
    content = await file.read()

    # 이미지 검증
    mime_type = validate_image_magic(content)
    if not mime_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드할 수 있습니다 (jpg, png, webp, gif)",
        )

    # 100x100 리사이즈
    try:
        img = Image.open(BytesIO(content))
        img = img.convert("RGBA")  # GIF/PNG 투명도 보존
        img = img.resize((CON_SIZE, CON_SIZE), Image.Resampling.LANCZOS)
        output = BytesIO()
        img.save(output, format="PNG")  # 콘은 PNG로 통일
        resized_content = output.getvalue()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이미지 처리 중 오류: {e}",
        )

    sha256 = calculate_sha256(resized_content)
    storage_key = generate_storage_key(".png")

    # 파일 저장
    from pathlib import Path
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / storage_key).write_bytes(resized_content)

    # DB 저장
    file_record = FileModel(
        uploader_id=current_user.id,
        original_name=file.filename or "con.png",
        mime_type="image/png",
        size=len(resized_content),
        sha256=sha256,
        storage_key=storage_key,
        thumb_key=None,
        width=CON_SIZE,
        height=CON_SIZE,
    )
    db.add(file_record)
    await db.flush()
    await db.refresh(file_record)

    return {
        "file_id": file_record.id,
        "image_url": _file_url(storage_key),
        "width": CON_SIZE,
        "height": CON_SIZE,
    }


# ═══════════════════════════════════════════
# 콘무리 신청
# ═══════════════════════════════════════════

@router.post(
    "/cons/packs",
    summary="콘무리 업로드 신청",
    status_code=status.HTTP_201_CREATED,
)
async def create_con_pack(
    name: str = Query(..., min_length=1, max_length=100),
    description: Optional[str] = Query(None, max_length=500),
    file_ids: str = Query(..., description="쉼표로 구분된 file_id 목록 (순서대로)"),
    db: DbSession = None,
    current_user: VerifiedUser = None,
):
    """
    콘무리를 업로드하여 승인 신청합니다.
    모든 이미지는 /cons/upload-image 로 먼저 업로드한 뒤,
    반환된 file_id 목록을 콤마로 연결하여 전달하세요.
    """
    try:
        id_list = [int(x.strip()) for x in file_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="file_ids 형식이 올바르지 않습니다")

    if not id_list:
        raise HTTPException(status_code=400, detail="파일 ID가 없습니다")
    if len(id_list) > 50:
        raise HTTPException(status_code=400, detail="콘무리는 최대 50개의 콘으로 구성할 수 있습니다")

    # 파일 존재 및 소유권 확인
    result = await db.execute(
        select(FileModel).where(
            FileModel.id.in_(id_list),
            FileModel.uploader_id == current_user.id,
            FileModel.is_active == True,  # noqa: E712
        )
    )
    files = {f.id: f for f in result.scalars().all()}

    missing = [fid for fid in id_list if fid not in files]
    if missing:
        raise HTTPException(status_code=400, detail=f"파일을 찾을 수 없거나 권한이 없습니다: {missing}")

    # ConPack 생성
    pack = ConPack(
        uploader_id=current_user.id,
        name=name,
        description=description,
        status=ConPackStatus.PENDING,
    )
    db.add(pack)
    await db.flush()

    # ConItem 생성 (순서 보장)
    for order, fid in enumerate(id_list):
        item = ConItem(
            pack_id=pack.id,
            file_id=fid,
            sort_order=order,
        )
        db.add(item)

    await db.flush()
    await db.refresh(pack)

    return {"id": pack.id, "name": pack.name, "status": pack.status.value, "item_count": len(id_list)}


# ═══════════════════════════════════════════
# 콘무리 스토어 (승인된 것만)
# ═══════════════════════════════════════════

@router.get(
    "/cons/packs",
    response_model=ConPackListResponse,
    summary="콘무리 스토어 목록",
)
async def list_con_packs(
    db: DbSession,
    current_user: VerifiedUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    search: Optional[str] = Query(None),
):
    """승인된 콘무리 목록을 조회합니다 (스토어)."""
    conditions = [ConPack.status == ConPackStatus.APPROVED]
    if search:
        conditions.append(ConPack.name.ilike(f"%{search}%"))

    count_result = await db.execute(
        select(func.count(ConPack.id)).where(*conditions)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(ConPack)
        .where(*conditions)
        .options(
            selectinload(ConPack.items).selectinload(ConItem.file)
        )
        .order_by(ConPack.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    packs = result.scalars().unique().all()

    return ConPackListResponse(
        packs=[_pack_to_response(p) for p in packs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/cons/packs/{pack_id}",
    response_model=ConPackDetailResponse,
    summary="콘무리 상세 조회",
)
async def get_con_pack(pack_id: int, db: DbSession, current_user: VerifiedUser):
    """콘무리 상세 (아이템 목록 포함)."""
    pack = await _load_pack(db, pack_id)
    if pack.status != ConPackStatus.APPROVED:
        # 본인 또는 관리자만 미승인 조회 가능
        if pack.uploader_id != current_user.id and not await _is_global_board_manager(db, current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다")

    return ConPackDetailResponse(
        **_pack_to_response(pack).model_dump(),
        items=[_item_to_response(i) for i in pack.items],
    )


@router.delete(
    "/cons/packs/{pack_id}",
    response_model=MessageResponse,
    summary="콘무리 삭제",
)
async def delete_con_pack(
    pack_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """자신이 신청한 콘무리 또는 전체 게시판 관리자가 콘무리를 삭제합니다."""
    pack = await _load_pack(db, pack_id, with_items=False)
    
    is_admin = await _is_global_board_manager(db, current_user)
    if pack.uploader_id != current_user.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다")
        
    await db.delete(pack)
    return MessageResponse(message="밤부콘이 삭제되었습니다")


# ═══════════════════════════════════════════
# 내 보관함
# ═══════════════════════════════════════════

@router.get(
    "/cons/my",
    response_model=List[MyConPackResponse],
    summary="내 콘무리 보관함 (에디터용)",
)
async def get_my_con_packs(db: DbSession, current_user: VerifiedUser):
    """내 보관함의 콘무리와 아이템 전체 조회 (에디터 피커용)."""
    result = await db.execute(
        select(UserConPack)
        .where(UserConPack.user_id == current_user.id)
        .options(
            selectinload(UserConPack.pack)
            .selectinload(ConPack.items)
            .selectinload(ConItem.file)
        )
        .order_by(UserConPack.id.desc())
    )
    my_packs = result.scalars().all()

    return [
        MyConPackResponse(
            id=ucp.pack.id,
            name=ucp.pack.name,
            thumbnail_url=_file_url(ucp.pack.items[0].file.storage_key) if ucp.pack.items else None,
            items=[_item_to_response(i) for i in ucp.pack.items],
        )
        for ucp in my_packs
    ]


@router.post(
    "/cons/packs/{pack_id}/add",
    response_model=MessageResponse,
    summary="내 보관함에 콘무리 추가",
)
async def add_con_pack_to_inventory(pack_id: int, db: DbSession, current_user: VerifiedUser):
    """콘무리를 내 보관함에 추가합니다."""
    pack = await _load_pack(db, pack_id, with_items=False)
    if pack.status != ConPackStatus.APPROVED:
        raise HTTPException(status_code=400, detail="승인된 콘무리만 추가할 수 있습니다")

    existing = await db.execute(
        select(UserConPack).where(
            UserConPack.user_id == current_user.id,
            UserConPack.pack_id == pack_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 보관함에 있습니다")

    db.add(UserConPack(user_id=current_user.id, pack_id=pack_id))
    return MessageResponse(message="보관함에 추가되었습니다")


@router.delete(
    "/cons/packs/{pack_id}/remove",
    response_model=MessageResponse,
    summary="내 보관함에서 콘무리 제거",
)
async def remove_con_pack_from_inventory(pack_id: int, db: DbSession, current_user: VerifiedUser):
    """콘무리를 내 보관함에서 제거합니다."""
    result = await db.execute(
        select(UserConPack).where(
            UserConPack.user_id == current_user.id,
            UserConPack.pack_id == pack_id,
        )
    )
    ucp = result.scalar_one_or_none()
    if not ucp:
        raise HTTPException(status_code=404, detail="보관함에 없습니다")
    await db.delete(ucp)
    return MessageResponse(message="보관함에서 제거되었습니다")


# ═══════════════════════════════════════════
# 콘 메타데이터 배치 조회 (렌더링용)
# ═══════════════════════════════════════════

@router.get(
    "/cons/items/meta",
    response_model=List[ConItemMeta],
    summary="콘 ID들의 이미지 URL 배치 조회",
)
async def get_con_items_meta(
    ids: str = Query(..., description="쉼표로 구분된 콘 아이템 ID 목록 (최대 100개)"),
    db: DbSession = None,
    current_user: VerifiedUser = None,
):
    """
    게시글/댓글 렌더링 시 사용합니다.
    본문에서 파싱된 콘 ID들의 이미지 URL을 한 번에 조회합니다.
    """
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids 형식이 올바르지 않습니다")

    if len(id_list) > 100:
        id_list = id_list[:100]

    result = await db.execute(
        select(ConItem)
        .where(ConItem.id.in_(id_list))
        .options(selectinload(ConItem.file))
    )
    items = result.scalars().all()

    return [ConItemMeta(id=item.id, image_url=_file_url(item.file.storage_key)) for item in items]


# ═══════════════════════════════════════════
# 내 신청 목록
# ═══════════════════════════════════════════

@router.get(
    "/cons/my-requests",
    response_model=ConPackListResponse,
    summary="내 콘무리 신청 목록",
)
async def get_my_con_requests(
    db: DbSession,
    current_user: VerifiedUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """내가 신청한 콘무리 목록 조회."""
    conditions = [ConPack.uploader_id == current_user.id]

    count_result = await db.execute(select(func.count(ConPack.id)).where(*conditions))
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(ConPack)
        .where(*conditions)
        .options(selectinload(ConPack.items).selectinload(ConItem.file))
        .order_by(ConPack.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    packs = result.scalars().unique().all()

    return ConPackListResponse(
        packs=[_pack_to_response(p) for p in packs],
        total=total,
        page=page,
        page_size=page_size,
    )


# ═══════════════════════════════════════════
# 관리자: 콘무리 승인/거절
# ═══════════════════════════════════════════

@router.get(
    "/admin/cons/requests",
    response_model=ConPackListResponse,
    summary="콘무리 신청 목록 (전체 게시판 관리자)",
)
async def admin_list_con_requests(
    db: DbSession,
    current_user: VerifiedUser,
    status_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """전체 게시판 관리자 또는 부관리자만 조회 가능합니다."""
    if not await _is_global_board_manager(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다")

    conditions = []
    if status_filter:
        try:
            conditions.append(ConPack.status == ConPackStatus(status_filter))
        except ValueError:
            pass

    count_result = await db.execute(
        select(func.count(ConPack.id)).where(*conditions) if conditions
        else select(func.count(ConPack.id))
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    query = (
        select(ConPack)
        .options(selectinload(ConPack.items).selectinload(ConItem.file))
        .order_by(ConPack.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    if conditions:
        query = query.where(*conditions)
    result = await db.execute(query)
    packs = result.scalars().unique().all()

    return ConPackListResponse(
        packs=[_pack_to_response(p) for p in packs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/admin/cons/requests/{pack_id}",
    response_model=MessageResponse,
    summary="콘무리 신청 승인/거절",
)
async def admin_resolve_con_request(
    pack_id: int,
    request_body: ConPackResolve,
    request: Request,
    db: DbSession,
    current_user: VerifiedUser,
):
    """전체 게시판 관리자 또는 부관리자가 처리합니다."""
    if not await _is_global_board_manager(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다")

    pack = await _load_pack(db, pack_id, with_items=False)

    if pack.status != ConPackStatus.PENDING:
        raise HTTPException(status_code=400, detail="이미 처리된 신청입니다")

    pack.status = ConPackStatus(request_body.status)
    pack.admin_note = request_body.admin_note
    pack.resolved_by_id = current_user.id

    await log_admin_action(
        db,
        admin_id=current_user.id,
        action="RESOLVE_CON_REQUEST",
        target_type="CON_PACK",
        target_id=pack_id,
        details={"new_status": request_body.status, "note": request_body.admin_note},
        ip_address=get_client_ip(request),
    )

    msg = "승인되었습니다" if request_body.status == "APPROVED" else "거절되었습니다"
    return MessageResponse(message=msg)
