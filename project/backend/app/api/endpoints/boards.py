"""
Board and Heading endpoints.
"""
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, VerifiedUser, AdminUser
from app.core.redis import cache
from app.models.board import Board, BoardType
from app.models.heading import Heading
from app.models.school import School
from app.models.board_accessible_school import BoardAccessibleSchool
from app.models.board_manager import BoardManager
from app.schemas.board import (
    BoardResponse,
    BoardListResponse,
    HeadingResponse,
    HeadingCreate,
)

router = APIRouter()


@router.get("", response_model=BoardListResponse)
async def get_boards(db: DbSession, current_user: VerifiedUser):
    """
    게시판 목록 조회.
    
    - 사용자의 학교 보드 (SCHOOL)
    - 전체 공용 보드 (GLOBAL)
    """
    # --- Redis cache check ---
    cache_key = f"boards:{current_user.school_id or 0}:{'admin' if current_user.is_admin else 'user'}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return JSONResponse(content=cached)

    # GLOBAL 보드
    result = await db.execute(
        select(Board)
        .where(Board.board_type == BoardType.GLOBAL, Board.is_active == True)  # noqa: E712
        .options(selectinload(Board.headings))
    )
    global_boards = result.scalars().all()

    # 사용자 학교의 SCHOOL 보드
    school_boards = []
    if current_user.is_admin:
        result = await db.execute(
            select(Board)
            .where(
                Board.board_type == BoardType.SCHOOL,
                Board.is_active == True,  # noqa: E712
            )
            .options(selectinload(Board.headings), selectinload(Board.school))
            .order_by(Board.id.desc())
        )
        school_boards = result.scalars().all()
    elif current_user.school_id:
        result = await db.execute(
            select(Board)
            .where(
                Board.board_type == BoardType.SCHOOL,
                Board.school_id == current_user.school_id,
                Board.is_active == True,  # noqa: E712
            )
            .options(selectinload(Board.headings), selectinload(Board.school))
        )
        school_boards = result.scalars().all()

    boards = []

    for board in school_boards:
        headings = [
            HeadingResponse(
                id=h.id,
                name=h.name,
                color=h.color,
                sort_order=h.sort_order,
            )
            for h in sorted(board.headings, key=lambda x: x.sort_order)
            if h.is_active
        ]
        boards.append(
            BoardResponse(
                id=board.id,
                name=board.name,
                description=board.description,
                board_type=board.board_type.value,
                school_id=board.school_id,
                school_name=board.school.name if board.school else None,
                headings=headings,
            )
        )

    for board in global_boards:
        headings = [
            HeadingResponse(
                id=h.id,
                name=h.name,
                color=h.color,
                sort_order=h.sort_order,
            )
            for h in sorted(board.headings, key=lambda x: x.sort_order)
            if h.is_active
        ]
        boards.append(
            BoardResponse(
                id=board.id,
                name=board.name,
                description=board.description,
                board_type=board.board_type.value,
                school_id=None,
                school_name=None,
                headings=headings,
            )
        )

    # CUSTOM 봄드 (접근 가능한 학교)
    custom_boards = []
    if current_user.school_id:
        # 사용자의 학교가 접근 가능한 커스텀 보드 조회
        result = await db.execute(
            select(Board)
            .join(BoardAccessibleSchool, BoardAccessibleSchool.board_id == Board.id)
            .where(
                Board.board_type == BoardType.CUSTOM,
                Board.is_active == True,  # noqa: E712
                BoardAccessibleSchool.school_id == current_user.school_id,
            )
            .options(selectinload(Board.headings), selectinload(Board.accessible_schools))
            .order_by(Board.id.desc())
        )
        custom_boards = result.scalars().unique().all()
    elif current_user.is_admin:
        result = await db.execute(
            select(Board)
            .where(Board.board_type == BoardType.CUSTOM, Board.is_active == True)  # noqa: E712
            .options(selectinload(Board.headings), selectinload(Board.accessible_schools))
            .order_by(Board.id.desc())
        )
        custom_boards = result.scalars().all()

    for board in custom_boards:
        headings = [
            HeadingResponse(
                id=h.id,
                name=h.name,
                color=h.color,
                sort_order=h.sort_order,
            )
            for h in sorted(board.headings, key=lambda x: x.sort_order)
            if h.is_active
        ]
        # 접근 가능 학교 이름 조합
        school_names = []
        if hasattr(board, 'accessible_schools') and board.accessible_schools:
            school_ids = [bas.school_id for bas in board.accessible_schools]
            s_result = await db.execute(select(School).where(School.id.in_(school_ids)))
            school_names = [s.short_name for s in s_result.scalars().all()]

        boards.append(
            BoardResponse(
                id=board.id,
                name=board.name,
                description=board.description,
                board_type=board.board_type.value,
                school_id=None,
                school_name=", ".join(school_names) if school_names else None,
                headings=headings,
            )
        )

    response = BoardListResponse(boards=boards)

    # --- Store in Redis (TTL 120s) ---
    await cache.set(cache_key, response.model_dump(mode="json"), ttl=120)

    return response


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(board_id: int, db: DbSession, current_user: VerifiedUser):
    """게시판 상세 조회."""
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id, Board.is_active == True)  # noqa: E712
        .options(selectinload(Board.headings), selectinload(Board.school))
    )
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시판을 찾을 수 없습니다",
        )

    # 접근 권한 확인
    if board.board_type == BoardType.SCHOOL:
        if not current_user.is_admin and board.school_id != current_user.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다",
            )
    elif board.board_type == BoardType.CUSTOM:
        if not current_user.is_admin:
            result_bas = await db.execute(
                select(BoardAccessibleSchool).where(
                    BoardAccessibleSchool.board_id == board_id,
                    BoardAccessibleSchool.school_id == current_user.school_id,
                )
            )
            if not result_bas.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="접근 권한이 없습니다",
                )

    headings = [
        HeadingResponse(
            id=h.id,
            name=h.name,
            color=h.color,
            sort_order=h.sort_order,
        )
        for h in sorted(board.headings, key=lambda x: x.sort_order)
        if h.is_active
    ]

    is_manager = False
    if current_user.is_admin:
        is_manager = True
    else:
        bm_result = await db.execute(
            select(BoardManager).where(
                BoardManager.board_id == board_id,
                BoardManager.user_id == current_user.id,
            )
        )
        is_manager = bm_result.scalar_one_or_none() is not None

    return BoardResponse(
        id=board.id,
        name=board.name,
        description=board.description,
        board_type=board.board_type.value,
        school_id=board.school_id,
        school_name=board.school.name if board.school else None,
        hot_post_threshold=board.hot_post_threshold,
        is_manager=is_manager,
        headings=headings,
    )


@router.get("/{board_id}/headings", response_model=list[HeadingResponse])
async def get_board_headings(board_id: int, db: DbSession, current_user: VerifiedUser):
    """게시판 글머리 목록 조회."""
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id, Board.is_active == True)  # noqa: E712
        .options(selectinload(Board.headings))
    )
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시판을 찾을 수 없습니다",
        )

    # 접근 권한 확인
    if board.board_type == BoardType.SCHOOL:
        if not current_user.is_admin and board.school_id != current_user.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다",
            )
    elif board.board_type == BoardType.CUSTOM:
        if not current_user.is_admin:
            result_bas = await db.execute(
                select(BoardAccessibleSchool).where(
                    BoardAccessibleSchool.board_id == board_id,
                    BoardAccessibleSchool.school_id == current_user.school_id,
                )
            )
            if not result_bas.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="접근 권한이 없습니다",
                )

    return [
        HeadingResponse(
            id=h.id,
            name=h.name,
            color=h.color,
            sort_order=h.sort_order,
        )
        for h in sorted(board.headings, key=lambda x: x.sort_order)
        if h.is_active
    ]


@router.post("/{board_id}/headings", response_model=HeadingResponse, status_code=status.HTTP_201_CREATED)
async def create_heading(
    board_id: int,
    request: HeadingCreate,
    db: DbSession,
    admin_user: AdminUser,
):
    """
    글머리 생성 (관리자 전용).
    """
    result = await db.execute(
        select(Board).where(Board.id == board_id, Board.is_active == True)  # noqa: E712
    )
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시판을 찾을 수 없습니다",
        )

    heading = Heading(
        board_id=board_id,
        name=request.name,
        color=request.color,
        sort_order=request.sort_order,
    )
    db.add(heading)
    await db.flush()
    await db.refresh(heading)

    return HeadingResponse(
        id=heading.id,
        name=heading.name,
        color=heading.color,
        sort_order=heading.sort_order,
    )

