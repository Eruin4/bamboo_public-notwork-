"""
Board management endpoints.
- 게시판 신청 (일반 사용자)
- 게시판 신청 승인/거절 (관리자)
- 게시판 관리 (게시판 관리자: 학교 초대/제거, 부관리자 임명, 글 삭제)
"""
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, VerifiedUser, AdminUser, get_client_ip
from app.models.board import Board, BoardType
from app.models.heading import Heading
from app.models.school import School
from app.models.board_request import BoardRequest, BoardRequestStatus
from app.models.board_accessible_school import BoardAccessibleSchool
from app.models.board_manager import BoardManager, ManagerRole
from app.models.post import Post
from app.models.user import User
from app.models.report import Report, ReportStatus
from app.schemas.board_manage import (
    BoardRequestCreate,
    BoardRequestResponse,
    BoardRequestResolve,
    BoardSchoolAdd,
    BoardSchoolRemove,
    SubManagerAdd,
    BoardManageResponse,
    BoardManageUpdate,
)
from app.schemas.auth import MessageResponse
from app.services.audit import log_admin_action

router = APIRouter()

DEFAULT_HEADINGS = [
    {"name": "일반", "color": "#6B7280", "sort_order": 0},
    {"name": "질문", "color": "#3B82F6", "sort_order": 1},
    {"name": "정보", "color": "#10B981", "sort_order": 2},
    {"name": "후기", "color": "#F59E0B", "sort_order": 3},
    {"name": "홍보", "color": "#8B5CF6", "sort_order": 4},
]


# ═══════════════════════════════════════════
# 게시판 신청 (일반 사용자)
# ═══════════════════════════════════════════

@router.post("/board-requests", response_model=BoardRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_board_request(
    request_body: BoardRequestCreate,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시판 생성 신청."""
    if current_user.school_id not in request_body.school_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자신의 학교를 포함해야 합니다",
        )

    result = await db.execute(
        select(School).where(School.id.in_(request_body.school_ids), School.is_active == True)  # noqa: E712
    )
    schools = result.scalars().all()
    if len(schools) != len(request_body.school_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 학교가 포함되어 있습니다",
        )

    result = await db.execute(
        select(BoardRequest).where(
            BoardRequest.board_name == request_body.board_name,
            BoardRequest.status == BoardRequestStatus.PENDING,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="동일한 이름의 신청이 이미 존재합니다",
        )

    board_request = BoardRequest(
        requester_id=current_user.id,
        board_name=request_body.board_name,
        board_description=request_body.board_description,
        school_ids=request_body.school_ids,
    )
    db.add(board_request)
    await db.flush()
    await db.refresh(board_request)

    school_names = [s.name for s in schools]

    return BoardRequestResponse(
        id=board_request.id,
        requester_id=board_request.requester_id,
        requester_email=current_user.personal_email,
        board_name=board_request.board_name,
        board_description=board_request.board_description,
        school_ids=board_request.school_ids,
        school_names=school_names,
        status=board_request.status.value,
        admin_note=board_request.admin_note,
        created_at=board_request.created_at,
    )


@router.get("/board-requests/my", response_model=list[BoardRequestResponse])
async def get_my_board_requests(
    db: DbSession,
    current_user: VerifiedUser,
):
    """내 게시판 신청 목록 조회."""
    result = await db.execute(
        select(BoardRequest)
        .where(BoardRequest.requester_id == current_user.id)
        .order_by(BoardRequest.created_at.desc())
    )
    requests = result.scalars().all()

    items = []
    for br in requests:
        school_result = await db.execute(
            select(School).where(School.id.in_(br.school_ids))
        )
        schools = school_result.scalars().all()
        school_names = [s.name for s in schools]

        items.append(BoardRequestResponse(
            id=br.id,
            requester_id=br.requester_id,
            requester_email=current_user.personal_email,
            board_name=br.board_name,
            board_description=br.board_description,
            school_ids=br.school_ids,
            school_names=school_names,
            status=br.status.value,
            admin_note=br.admin_note,
            created_at=br.created_at,
        ))

    return items


# ═══════════════════════════════════════════
# 관리자: 게시판 신청 관리
# ═══════════════════════════════════════════

@router.get("/admin/board-requests", response_model=list[BoardRequestResponse])
async def get_board_requests_admin(
    db: DbSession,
    admin_user: AdminUser,
    status_filter: str | None = None,
):
    """게시판 신청 목록 조회 (관리자)."""
    query = select(BoardRequest).options(
        selectinload(BoardRequest.requester)
    ).order_by(BoardRequest.created_at.desc())

    if status_filter:
        query = query.where(BoardRequest.status == BoardRequestStatus(status_filter))

    result = await db.execute(query)
    requests = result.scalars().all()

    items = []
    for br in requests:
        school_result = await db.execute(
            select(School).where(School.id.in_(br.school_ids))
        )
        schools = school_result.scalars().all()
        school_names = [s.name for s in schools]

        requester_school_result = await db.execute(
            select(School.name).where(School.id == br.requester.school_id)
        ) if br.requester.school_id else None
        requester_school_name = requester_school_result.scalar_one_or_none() if requester_school_result else None

        items.append(BoardRequestResponse(
            id=br.id,
            requester_id=br.requester_id,
            requester_email=br.requester.personal_email,
            requester_school_name=requester_school_name,
            board_name=br.board_name,
            board_description=br.board_description,
            school_ids=br.school_ids,
            school_names=school_names,
            status=br.status.value,
            admin_note=br.admin_note,
            created_at=br.created_at,
        ))

    return items


@router.post("/admin/board-requests/{request_id}/resolve", response_model=MessageResponse)
async def resolve_board_request(
    request_id: int,
    request_body: BoardRequestResolve,
    request: Request,
    db: DbSession,
    admin_user: AdminUser,
):
    """게시판 신청 처리 (관리자)."""
    result = await db.execute(
        select(BoardRequest).where(BoardRequest.id == request_id)
    )
    board_request = result.scalar_one_or_none()

    if not board_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="신청을 찾을 수 없습니다",
        )

    if board_request.status != BoardRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 처리된 신청입니다",
        )

    new_status = BoardRequestStatus(request_body.action)
    board_request.status = new_status
    board_request.admin_note = request_body.admin_note
    board_request.resolved_by_id = admin_user.id

    if new_status == BoardRequestStatus.APPROVED:
        # 삭제 요청 처리
        if board_request.board_name.startswith("[DELETE] "):
            import re
            match = re.search(r"board_id=(\d+)", board_request.board_description or "")
            if match:
                target_board_id = int(match.group(1))
                delete_target = await db.get(Board, target_board_id)
                if delete_target:
                    await db.delete(delete_target)
                    msg = "게시판이 삭제되었습니다"
                else:
                    msg = "이미 삭제된 게시판입니다"
            else:
                 msg = "게시판 ID를 찾을 수 없습니다"
            
            await log_admin_action(
                db,
                admin_id=admin_user.id,
                action="APPROVE_DELETE_BOARD",
                target_type="BOARD",
                target_id=target_board_id if 'target_board_id' in locals() else 0,
                details={"request_id": request_id},
                ip_address=get_client_ip(request),
            )
            return MessageResponse(message=msg)

        board = Board(
            name=board_request.board_name,
            description=board_request.board_description,
            board_type=BoardType.CUSTOM,
        )
        db.add(board)
        await db.flush()

        for school_id in board_request.school_ids:
            bas = BoardAccessibleSchool(
                board_id=board.id,
                school_id=school_id,
            )
            db.add(bas)

        for heading_data in DEFAULT_HEADINGS:
            heading = Heading(
                board_id=board.id,
                **heading_data,
            )
            db.add(heading)

        # 신청자를 OWNER로 등록
        manager = BoardManager(
            board_id=board.id,
            user_id=board_request.requester_id,
            role=ManagerRole.OWNER.value,
        )
        db.add(manager)

        await log_admin_action(
            db,
            admin_id=admin_user.id,
            action="APPROVE_BOARD_REQUEST",
            target_type="BOARD_REQUEST",
            target_id=request_id,
            details={
                "board_name": board_request.board_name,
                "board_id": board.id,
                "school_ids": board_request.school_ids,
            },
            ip_address=get_client_ip(request),
        )

        return MessageResponse(message=f"게시판 '{board_request.board_name}'이(가) 생성되었습니다")
    else:
        await log_admin_action(
            db,
            admin_id=admin_user.id,
            action="REJECT_BOARD_REQUEST",
            target_type="BOARD_REQUEST",
            target_id=request_id,
            details={
                "board_name": board_request.board_name,
                "admin_note": request_body.admin_note,
            },
            ip_address=get_client_ip(request),
        )

        return MessageResponse(message="신청이 거절되었습니다")


# ═══════════════════════════════════════════
# 게시판 관리자 기능
# ═══════════════════════════════════════════

async def _get_board_with_managers(db, board_id: int, user: User = None) -> Board:
    """게시판 + 관계 로드."""
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id, Board.is_active == True)  # noqa: E712
        .options(
            selectinload(Board.accessible_schools),
            selectinload(Board.managers),
        )
    )
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시판을 찾을 수 없습니다",
        )

    # Allow SCHOOL type for admins or managers
    allowed_types = [BoardType.CUSTOM, BoardType.GLOBAL]
    if user:
        if user.role == "ADMIN":
            allowed_types.append(BoardType.SCHOOL)
        else:
            # Check if user is a manager of this board
            role = _get_user_role(board, user.id)
            if role:
                allowed_types.append(BoardType.SCHOOL)

    if board.board_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이 게시판은 관리할 수 없습니다",
        )

    return board


# ... (update usages) ...

@router.get("/manage/boards/{board_id}/reports")
async def get_board_reports(
    board_id: int,
    db: DbSession,
    current_user: VerifiedUser,
    status_filter: str | None = None,
    page: int = 1,
):
    """게시판 내 신고 목록 조회 (OWNER, SUB_MANAGER)."""
    from sqlalchemy import func
    from app.models.post import Post
    from app.models.report import ReportTargetType
    from app.models.comment import Comment

    board = await _get_board_with_managers(db, board_id, current_user)
    _check_any_manager(board, current_user)

    page_size = 20
    offset = (page - 1) * page_size

    conditions = [Report.board_id == board_id]
    if status_filter:
        try:
            conditions.append(Report.status == ReportStatus(status_filter))
        except ValueError:
            pass

    count_result = await db.execute(
        select(func.count(Report.id)).where(*conditions)
    )
    total = count_result.scalar() or 0

    query = (
        select(Report)
        .where(*conditions)
        .order_by(Report.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    reports = result.scalars().all()

    report_items = []
    for r in reports:
        post_id = None
        if r.target_type == ReportTargetType.POST:
            post_id = r.target_id
        elif r.target_type == ReportTargetType.COMMENT:
            # Need to fetch comment to get post_id
            comment = await db.get(Comment, r.target_id)
            if comment:
                post_id = comment.post_id
        
        report_items.append({
            "id": r.id,
            "reporter_id": r.reporter_id,
            "target_type": r.target_type.value if hasattr(r.target_type, 'value') else r.target_type,
            "target_id": r.target_id,
            "board_id": r.board_id,
            "post_id": post_id,
            "reason": r.reason,
            "description": r.description,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "resolved_by_id": r.resolved_by_id,
            "resolution_note": r.resolution_note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "reports": report_items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _get_user_role(board: Board, user_id: int) -> str | None:
    """사용자의 게시판 역할을 반환."""
    for m in board.managers:
        if m.user_id == user_id:
            return m.role
    return None


def _check_owner(board: Board, user: User):
    """OWNER 권한 확인."""
    if user.role == "ADMIN":  # UserRole.ADMIN matches string "ADMIN"
        return
    
    role = _get_user_role(board, user.id)
    if role != ManagerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="게시판 관리자(OWNER)만 접근할 수 있습니다",
        )


def _check_any_manager(board: Board, user: User):
    """OWNER 또는 SUB_MANAGER 권한 확인."""
    if user.role == "ADMIN":
        return

    role = _get_user_role(board, user.id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="게시판 관리자만 접근할 수 있습니다",
        )


async def _build_manage_response(db, board: Board, current_user_id: int) -> BoardManageResponse:
    """BoardManageResponse 구성."""
    school_ids = [bas.school_id for bas in board.accessible_schools]
    school_result = await db.execute(
        select(School).where(School.id.in_(school_ids))
    ) if school_ids else None
    schools = school_result.scalars().all() if school_result else []

    accessible_schools = [
        {"id": s.id, "name": s.name, "short_name": s.short_name}
        for s in schools
    ]

    manager_user_ids = [m.user_id for m in board.managers]
    manager_result = await db.execute(
        select(User).where(User.id.in_(manager_user_ids))
    ) if manager_user_ids else None
    manager_users = manager_result.scalars().all() if manager_result else []
    user_map = {u.id: u for u in manager_users}

    managers = []
    owner_school_id = None
    for m in board.managers:
        u = user_map.get(m.user_id)
        if u:
            managers.append({
                "user_id": u.id,
                "email": u.personal_email,
                "role": m.role,
                "school_id": u.school_id,
            })
            if m.role == ManagerRole.OWNER.value:
                owner_school_id = u.school_id

    my_role = _get_user_role(board, current_user_id)

    return BoardManageResponse(
        id=board.id,
        name=board.name,
        description=board.description,
        board_type=board.board_type.value,
        is_active=board.is_active,
        hot_post_threshold=board.hot_post_threshold,
        accessible_schools=accessible_schools,
        managers=managers,
        owner_school_id=owner_school_id,
        my_role=my_role,
        created_at=board.created_at,
    )


@router.get("/manage/boards/{board_id}", response_model=BoardManageResponse)
async def get_board_manage_info(
    board_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시판 관리 정보 조회 (OWNER + SUB_MANAGER 모두 접근 가능)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_any_manager(board, current_user)

    return await _build_manage_response(db, board, current_user.id)


@router.patch("/manage/boards/{board_id}", response_model=MessageResponse)
async def update_board(
    board_id: int,
    request_body: BoardManageUpdate,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시판 정보 수정 (OWNER만)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    if request_body.description is not None:
        board.description = request_body.description
        
    if request_body.hot_post_threshold is not None:
        board.hot_post_threshold = request_body.hot_post_threshold

    return MessageResponse(message="게시판 정보가 수정되었습니다")


@router.post("/manage/boards/{board_id}/schools", response_model=MessageResponse)
async def add_school_to_board(
    board_id: int,
    request_body: BoardSchoolAdd,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시판에 학교 추가 (OWNER만)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    if board.board_type == BoardType.GLOBAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="전체 게시판은 학교를 추가할 수 없습니다",
        )

    result = await db.execute(
        select(School).where(School.id == request_body.school_id, School.is_active == True)  # noqa: E712
    )
    school = result.scalar_one_or_none()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="학교를 찾을 수 없습니다",
        )

    existing = any(bas.school_id == request_body.school_id for bas in board.accessible_schools)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 학교입니다",
        )

    bas = BoardAccessibleSchool(
        board_id=board_id,
        school_id=request_body.school_id,
    )
    db.add(bas)

    return MessageResponse(message=f"{school.name}이(가) 게시판에 추가되었습니다")


@router.delete("/manage/boards/{board_id}/schools/{school_id}", response_model=MessageResponse)
async def remove_school_from_board(
    board_id: int,
    school_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시판에서 학교 제거 (OWNER만, 관리자 학교는 제거 불가)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    if board.board_type == BoardType.GLOBAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="전체 게시판은 학교를 제거할 수 없습니다",
        )

    # 관리자의 학교는 제거 불가
    if school_id == current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="관리자의 학교는 제거할 수 없습니다",
        )

    if len(board.accessible_schools) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="최소 1개의 학교는 유지해야 합니다",
        )

    target = None
    for bas in board.accessible_schools:
        if bas.school_id == school_id:
            target = bas
            break

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 학교가 이 게시판에 등록되어 있지 않습니다",
        )

    await db.delete(target)
    return MessageResponse(message="학교가 게시판에서 제거되었습니다")


# ═══════════════════════════════════════════
# 부관리자 관리 (OWNER만)
# ═══════════════════════════════════════════

@router.get("/manage/boards/{board_id}/sub-manager-candidates")
async def get_sub_manager_candidates(
    board_id: int,
    db: DbSession,
    current_user: VerifiedUser,
    q: str | None = None,
):
    """부관리자 후보 목록 (모든 학교 사용자 가능, 검색어로 필터링)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    # 이미 관리자인 사용자 ID 목록
    existing_manager_ids = {m.user_id for m in board.managers}

    # 모든 활성 인증 사용자 조회 (학교 무관, 최대 50명)
    conditions = [
        User.is_active == True,  # noqa: E712
        User.school_email_verified == True,  # noqa: E712
        User.id.notin_(existing_manager_ids),
    ]
    if q:
        conditions.append(User.personal_email.ilike(f"%{q}%"))

    result = await db.execute(
        select(User).where(*conditions).order_by(User.personal_email).limit(50)
    )
    candidates = result.scalars().all()

    return [
        {"user_id": u.id, "email": u.personal_email, "nickname": u.nickname, "school_id": u.school_id}
        for u in candidates
    ]


@router.post("/manage/boards/{board_id}/sub-managers", response_model=MessageResponse)
async def add_sub_manager(
    board_id: int,
    request_body: SubManagerAdd,
    db: DbSession,
    current_user: VerifiedUser,
):
    """부관리자 임명 (OWNER만)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    # 후보 사용자 확인
    result = await db.execute(
        select(User).where(User.id == request_body.user_id, User.is_active == True)  # noqa: E712
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    # 부관리자는 다른 학교 사용자도 임명 가능 (학교 제한 없음)
    if not target_user.school_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="학교 인증이 완료된 사용자만 부관리자로 임명할 수 있습니다",
        )

    # 이미 관리자인지 확인
    existing = any(m.user_id == request_body.user_id for m in board.managers)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 관리자입니다")

    manager = BoardManager(
        board_id=board_id,
        user_id=request_body.user_id,
        role=ManagerRole.SUB_MANAGER.value,
    )
    db.add(manager)

    return MessageResponse(message=f"부관리자가 임명되었습니다")


@router.delete("/manage/boards/{board_id}/sub-managers/{user_id}", response_model=MessageResponse)
async def remove_sub_manager(
    board_id: int,
    user_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """부관리자 해제 (OWNER만)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    target = None
    for m in board.managers:
        if m.user_id == user_id and m.role == ManagerRole.SUB_MANAGER.value:
            target = m
            break

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 부관리자를 찾을 수 없습니다",
        )

    await db.delete(target)
    return MessageResponse(message="부관리자가 해제되었습니다")


# ═══════════════════════════════════════════
# 게시글 삭제 (OWNER + SUB_MANAGER 모두 가능)
# ═══════════════════════════════════════════

@router.delete("/manage/boards/{board_id}/posts/{post_id}", response_model=MessageResponse)
async def board_manager_delete_post(
    board_id: int,
    post_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시글 삭제 (게시판 관리자 + 부관리자)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_any_manager(board, current_user)

    result = await db.execute(
        select(Post).where(
            Post.id == post_id,
            Post.board_id == board_id,
            Post.is_deleted == False,  # noqa: E712
        )
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다",
        )

    post.is_deleted = True
    return MessageResponse(message="게시글이 삭제되었습니다")


# ═══════════════════════════════════════════
# 학교 목록 조회 (게시판 신청 시 학교 선택용)
# ═══════════════════════════════════════════

@router.get("/manage/schools")
async def get_schools_list(
    db: DbSession,
    current_user: VerifiedUser,
):
    """활성 학교 목록 조회 (게시판 신청용)."""
    result = await db.execute(
        select(School).where(School.is_active == True).order_by(School.name)  # noqa: E712
    )
    schools = result.scalars().all()

    return [
        {"id": s.id, "name": s.name, "short_name": s.short_name}
        for s in schools
    ]


# ═══════════════════════════════════════════
# 내가 관리하는 게시판 목록
# ═══════════════════════════════════════════

@router.get("/manage/boards", response_model=list[BoardManageResponse])
async def get_my_managed_boards(
    db: DbSession,
    current_user: VerifiedUser,
):
    """내가 관리하는 게시판 목록 (OWNER + SUB_MANAGER + ADMIN)."""
    if current_user.role == "ADMIN":
        # 관리자는 모든 CUSTOM/GLOBAL 게시판 관리 가능
        result = await db.execute(
            select(Board)
            .where(
                Board.board_type.in_([BoardType.CUSTOM, BoardType.GLOBAL, BoardType.SCHOOL]),
                Board.is_active == True  # noqa: E712
            )
            .options(
                selectinload(Board.accessible_schools),
                selectinload(Board.managers),
            )
        )
        boards = result.scalars().all()
        
        items = []
        for board in boards:
            response = await _build_manage_response(db, board, current_user.id)
            items.append(response)
        return items

    result = await db.execute(
        select(BoardManager).where(BoardManager.user_id == current_user.id)
    )
    board_managers = result.scalars().all()

    items = []
    for bm in board_managers:
        board_result = await db.execute(
            select(Board)
            .where(Board.id == bm.board_id, Board.is_active == True)  # noqa: E712
            .options(
                selectinload(Board.accessible_schools),
                selectinload(Board.managers),
            )
        )
        board = board_result.scalar_one_or_none()
        if not board:
            continue

        response = await _build_manage_response(db, board, current_user.id)
        items.append(response)

    return items


# =============================================
# 게시판별 신고 관리
# =============================================


# @router.get("/manage/boards/{board_id}/reports")
async def _deprecated_get_board_reports(
    board_id: int,
    db: DbSession,
    current_user: VerifiedUser,
    status_filter: str | None = None,
    page: int = 1,
):
    """게시판 내 신고 목록 조회 (OWNER, SUB_MANAGER)."""
    from sqlalchemy import func

    board = await _get_board_with_managers(db, board_id, current_user)
    _check_any_manager(board, current_user)

    page_size = 20
    offset = (page - 1) * page_size

    conditions = [Report.board_id == board_id]
    if status_filter:
        try:
            conditions.append(Report.status == ReportStatus(status_filter))
        except ValueError:
            pass

    count_result = await db.execute(
        select(func.count(Report.id)).where(*conditions)
    )
    total = count_result.scalar() or 0

    query = (
        select(Report)
        .where(*conditions)
        .order_by(Report.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    reports = result.scalars().all()

    return {
        "reports": [
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "target_type": r.target_type.value if hasattr(r.target_type, 'value') else r.target_type,
                "target_id": r.target_id,
                "board_id": r.board_id,
                "reason": r.reason,
                "description": r.description,
                "status": r.status.value if hasattr(r.status, 'value') else r.status,
                "resolved_by_id": r.resolved_by_id,
                "resolution_note": r.resolution_note,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reports
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/manage/boards/{board_id}/reports/{report_id}", response_model=MessageResponse)
async def resolve_board_report(
    board_id: int,
    report_id: int,
    db: DbSession,
    current_user: VerifiedUser,
    request_body: dict = None,
):
    """게시판 신고 처리 (OWNER, SUB_MANAGER)."""
    from fastapi import Body
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_any_manager(board, current_user)

    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.board_id == board_id)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="신고를 찾을 수 없습니다",
        )

    # Parse request body
    if not request_body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="처리 상태를 지정해주세요")

    new_status_str = request_body.get("status")
    resolution_note = request_body.get("resolution_note")

    try:
        new_status = ReportStatus(new_status_str)
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바른 상태값이 아닙니다 (REVIEWED, RESOLVED, DISMISSED)",
        )

    report.status = new_status
    report.resolved_by_id = current_user.id
    report.resolution_note = resolution_note

    return MessageResponse(message="신고가 처리되었습니다")


# =============================================
# 게시판 삭제 요청
# =============================================


@router.post("/manage/boards/{board_id}/delete-request", response_model=MessageResponse)
async def request_board_deletion(
    board_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시판 삭제 요청 (OWNER만)."""
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    # 삭제 요청을 BoardRequest로 기록 (status = PENDING, 특별 마커)
    from app.models.board_request import BoardRequest, BoardRequestStatus

    existing = await db.execute(
        select(BoardRequest).where(
            BoardRequest.requester_id == current_user.id,
            BoardRequest.board_name == f"[DELETE] {board.name}",
            BoardRequest.status == BoardRequestStatus.PENDING,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 삭제 요청이 진행 중입니다",
        )

    delete_request = BoardRequest(
        requester_id=current_user.id,
        board_name=f"[DELETE] {board.name}",
        board_description=f"게시판 삭제 요청 (board_id={board_id})",
        school_ids=[bas.school_id for bas in board.accessible_schools],
        status=BoardRequestStatus.PENDING,
    )
    db.add(delete_request)

    return MessageResponse(message="게시판 삭제 요청이 접수되었습니다. 관리자 승인 후 삭제됩니다.")


@router.post("/manage/boards/{board_id}/transfer-ownership", response_model=MessageResponse)
async def transfer_board_ownership(
    board_id: int,
    request_body: SubManagerAdd,
    request: Request,
    db: DbSession,
    current_user: VerifiedUser,
):
    """
    게시판 소유권 이전 (OWNER 또는 ADMIN).
    기존 OWNER(신청자)와 같은 학교의 사용자에게만 위임 가능.
    """
    board = await _get_board_with_managers(db, board_id, current_user)
    _check_owner(board, current_user)

    # 1. 대상 사용자 확인
    result = await db.execute(
        select(User).where(User.id == request_body.user_id, User.is_active == True)  # noqa: E712
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )
    
    # 2. 학교 확인 (기존 OWNER(신청자)와 같은 학교인지 확인)
    current_owner_manager = next((m for m in board.managers if m.role == ManagerRole.OWNER.value), None)
    
    if current_owner_manager:
        current_owner = await db.get(User, current_owner_manager.user_id)
        if current_owner and target_user.school_id != current_owner.school_id:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="기존 소유자와 같은 학교의 사용자에게만 위임할 수 있습니다",
            )
    
    # 3. 소유권 이전 처리
    # 3-1. 기존 OWNER -> SUB_MANAGER
    if current_owner_manager:
        current_owner_manager.role = ManagerRole.SUB_MANAGER.value
        db.add(current_owner_manager)
    
    # 3-2. 대상 사용자 -> OWNER
    target_manager = next((m for m in board.managers if m.user_id == target_user.id), None)
    if target_manager:
        target_manager.role = ManagerRole.OWNER.value
        db.add(target_manager)
    else:
        new_manager = BoardManager(
            board_id=board.id,
            user_id=target_user.id,
            role=ManagerRole.OWNER.value,
        )
        db.add(new_manager)

    # 감사 로그
    await log_admin_action(
        db,
        admin_id=current_user.id,
        action="TRANSFER_OWNERSHIP",
        target_type="BOARD",
        target_id=board.id,
        details={
            "old_owner_id": current_owner_manager.user_id if current_owner_manager else None,
            "new_owner_id": target_user.id,
            "board_name": board.name
        },
        ip_address=get_client_ip(request),
    )

    return MessageResponse(message=f"게시판 소유권이 {target_user.nickname or target_user.personal_email}님에게 이전되었습니다")

