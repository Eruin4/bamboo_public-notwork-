"""
Post endpoints.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, VerifiedUser, AdminUser, get_client_ip
from app.core.redis import cache
from app.models.board import Board, BoardType
from app.models.heading import Heading
from app.models.post import Post
from app.models.file import File
from app.models.post_file import PostFile
from app.models.school import School
from app.models.vote import PostVote, VoteType
from app.models.board_accessible_school import BoardAccessibleSchool
from app.models.board_manager import BoardManager
from app.models.scrap import Scrap
from app.schemas.post import (
    PostCreate,
    PostResponse,
    PostListItem,
    PostListResponse,
    AuthorInfo,
    FileInfo,
    PinRequest,
    VoteRequest,
    VoteResponse,
)
from app.schemas.auth import MessageResponse
from app.services.anon import get_anon_number
from app.services.author_info import get_author_metadata_maps
from app.services.audit import log_admin_action

router = APIRouter()


async def get_author_info(
    db,
    board: Board,
    author_id: int,
    current_user_id: int,
    nickname: str | None = None,
) -> AuthorInfo:
    """작성자 정보 생성."""
    anon_number = await get_anon_number(db, board.id, author_id)
    school_name = None

    # 학교명 표시 (항상)
    from app.models.user import User
    result = await db.execute(
        select(School.short_name)
        .join(User, User.school_id == School.id)
        .where(User.id == author_id)
    )
    school_name = result.scalar_one_or_none()

    return AuthorInfo(
        anon_number=anon_number,
        school_name=school_name,
        nickname=nickname,
        is_author=author_id == current_user_id,
    )


@router.get("/boards/{board_id}/posts", response_model=PostListResponse)
async def get_posts(
    board_id: int,
    db: DbSession,
    current_user: VerifiedUser,
    heading_id: int | None = Query(None),
    hot: bool = Query(False),
    notice: bool = Query(False),
    q: str | None = Query(None, max_length=100),  # 검색어
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
):
    """게시글 목록 조회."""
    # 검색어가 있으면 캐시 건너뜀 (검색은 실시간으로)
    q_clean = q.strip() if q else None
    if not q_clean:
        cache_key = f"posts:{board_id}:{heading_id or 'all'}:{page}:{hot}:{notice}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return JSONResponse(content=cached)
    else:
        cache_key = None
    # 게시판 조회 및 권한 확인
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id, Board.is_active == True)  # noqa: E712
        .options(selectinload(Board.school))
    )
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시판을 찾을 수 없습니다",
        )

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

    # 쿼리 조건
    conditions = [
        Post.board_id == board_id,
        Post.is_deleted == False,  # noqa: E712
        Post.is_hidden == False,  # noqa: E712
    ]
    if heading_id:
        conditions.append(Post.heading_id == heading_id)

    if hot:
        conditions.append(Post.like_count >= board.hot_post_threshold)

    if notice:
        conditions.append(Post.is_notice == True)  # noqa: E712

    if q_clean:
        # 제목 + 본문 대소문자 구분 없이 검색 (ILIKE)
        conditions.append(
            or_(
                Post.title.ilike(f"%{q_clean}%"),
                Post.body.ilike(f"%{q_clean}%"),
            )
        )

    # 전체 개수
    count_result = await db.execute(
        select(func.count(Post.id)).where(and_(*conditions))
    )
    total = count_result.scalar() or 0

    # 게시글 조회
    offset = (page - 1) * page_size

    # 전체글 탭에서만 최신 공지 1개를 상단 고정, 나머지는 시간순
    if not hot and not notice:
        latest_notice_id_subq = (
            select(Post.id)
            .where(
                Post.board_id == board_id,
                Post.is_notice == True,  # noqa: E712
                Post.is_deleted == False,  # noqa: E712
                Post.is_hidden == False,  # noqa: E712
            )
            .order_by(Post.created_at.desc())
            .limit(1)
            .scalar_subquery()
        )
        pin_expr = case(
            (Post.id == latest_notice_id_subq, 0),
            else_=1,
        )
        order_clauses = [
            pin_expr,          # 최신 공지 1개: 0 → 최상위
            Post.is_pinned.desc(),
            Post.created_at.desc(),
        ]
    else:
        # 인기글·공지 탭은 단순 시간순
        order_clauses = [Post.is_pinned.desc(), Post.created_at.desc()]

    result = await db.execute(
        select(Post)
        .where(and_(*conditions))
        .options(selectinload(Post.heading), selectinload(Post.post_files))
        .order_by(*order_clauses)
        .offset(offset)
        .limit(page_size)
    )
    posts = result.scalars().all()
    author_ids = {post.user_id for post in posts}
    anon_numbers, school_names = await get_author_metadata_maps(
        db,
        board.id,
        author_ids,
    )

    # 응답 생성
    items = []
    for post in posts:
        items.append(
            PostListItem(
                id=post.id,
                heading_id=post.heading_id,
                heading_name=post.heading.name if post.heading else None,
                heading_color=post.heading.color if post.heading else None,
                title=post.title,
                author=AuthorInfo(
                    anon_number=anon_numbers.get(post.user_id),
                    school_name=school_names.get(post.user_id),
                    nickname=post.nickname,
                    is_author=post.user_id == current_user.id,
                ),
                is_pinned=post.is_pinned,
                is_notice=post.is_notice,
                view_count=post.view_count,
                comment_count=post.comment_count,
                like_count=post.like_count,
                dislike_count=post.dislike_count,
                has_attachment=len(post.post_files) > 0,
                created_at=post.created_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    response = PostListResponse(
        posts=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

    # --- Store in Redis (TTL 60s) ---
    if cache_key is not None:
        await cache.set(cache_key, response.model_dump(mode="json"), ttl=60)

    return response


@router.post("/boards/{board_id}/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    board_id: int,
    request: PostCreate,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시글 작성."""
    # 게시판 조회 및 권한 확인
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id, Board.is_active == True)  # noqa: E712
        .options(selectinload(Board.school))
    )
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시판을 찾을 수 없습니다",
        )

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

    # 글머리 확인
    if request.heading_id:
        result = await db.execute(
            select(Heading).where(
                Heading.id == request.heading_id,
                Heading.board_id == board_id,
                Heading.is_active == True,  # noqa: E712
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않은 글머리입니다",
            )

    # 첨부 파일 확인
    files = []
    if request.attached_file_ids:
        result = await db.execute(
            select(File).where(
                File.id.in_(request.attached_file_ids),
                File.uploader_id == current_user.id,
                File.is_active == True,  # noqa: E712
            )
        )
        files = result.scalars().all()
        if len(files) != len(request.attached_file_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않은 파일이 포함되어 있습니다",
            )

    # 닉네임 처리
    post_nickname = None
    if request.use_nickname and current_user.nickname:
        post_nickname = current_user.nickname
        
    # 공지 처리
    is_notice = False
    if request.is_notice:
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
        if not is_manager:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="공지 작성 권한이 없습니다",
            )
        is_notice = True

    # 게시글 생성
    post = Post(
        board_id=board_id,
        heading_id=request.heading_id,
        user_id=current_user.id,
        title=request.title,
        body=request.body,
        nickname=post_nickname,
        is_notice=is_notice,
    )
    db.add(post)
    await db.flush()

    # 파일 연결
    for i, file in enumerate(files):
        post_file = PostFile(
            post_id=post.id,
            file_id=file.id,
            sort_order=i,
        )
        db.add(post_file)

    await db.flush()
    await db.refresh(post)

    # 응답 생성
    author_info = await get_author_info(db, board, post.user_id, current_user.id, nickname=post_nickname)

    post_response = PostResponse(
        id=post.id,
        board_id=post.board_id,
        heading_id=post.heading_id,
        heading_name=None,
        heading_color=None,
        title=post.title,
        body=post.body,
        author=author_info,
        is_pinned=post.is_pinned,
        is_notice=post.is_notice,
        is_hidden=post.is_hidden,
        view_count=post.view_count,
        comment_count=post.comment_count,
        like_count=0,
        dislike_count=0,
        my_vote=None,
        files=[
            FileInfo(
                id=f.id,
                original_name=f.original_name,
                mime_type=f.mime_type,
                size=f.size,
                storage_key=f.storage_key,
                thumb_key=f.thumb_key,
                width=f.width,
                height=f.height,
            )
            for f in files
        ],
        created_at=post.created_at,
        updated_at=post.updated_at,
    )

    # --- Invalidate posts cache for this board ---
    await cache.delete_pattern(f"posts:{board_id}:*")

    return post_response


@router.get("/posts/my", response_model=PostListResponse)
async def get_my_posts(
    db: DbSession,
    current_user: VerifiedUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
):
    """내가 쓴 게시글 목록 조회."""
    conditions = [
        Post.user_id == current_user.id,
        Post.is_deleted == False,  # noqa: E712
    ]

    # 전체 개수
    count_result = await db.execute(
        select(func.count(Post.id)).where(and_(*conditions))
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Post)
        .where(and_(*conditions))
        .options(
            selectinload(Post.heading),
            selectinload(Post.post_files),
            selectinload(Post.board),
        )
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    posts_list = result.scalars().all()

    items = []
    for post in posts_list:
        items.append(
            PostListItem(
                id=post.id,
                board_id=post.board_id,
                board_name=post.board.name if post.board else None,
                heading_id=post.heading_id,
                heading_name=post.heading.name if post.heading else None,
                heading_color=post.heading.color if post.heading else None,
                title=post.title,
                author=AuthorInfo(is_author=True),
                is_pinned=post.is_pinned,
                is_notice=post.is_notice,
                view_count=post.view_count,
                comment_count=post.comment_count,
                like_count=post.like_count,
                dislike_count=post.dislike_count,
                has_attachment=len(post.post_files) > 0,
                created_at=post.created_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return PostListResponse(
        posts=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/posts/scrapped", response_model=PostListResponse)
async def get_scrapped_posts(
    db: DbSession,
    current_user: VerifiedUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
):
    """스크랩한 게시글 목록 조회."""
    # 전체 개수
    count_result = await db.execute(
        select(func.count(Scrap.id)).where(Scrap.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Scrap)
        .where(Scrap.user_id == current_user.id)
        .options(
            selectinload(Scrap.post).selectinload(Post.heading),
            selectinload(Scrap.post).selectinload(Post.post_files),
            selectinload(Scrap.post).selectinload(Post.board),
        )
        .order_by(Scrap.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    scraps = result.scalars().all()

    items = []
    for scrap in scraps:
        post = scrap.post
        if post.is_deleted:
            continue
        items.append(
            PostListItem(
                id=post.id,
                board_id=post.board_id,
                board_name=post.board.name if post.board else None,
                heading_id=post.heading_id,
                heading_name=post.heading.name if post.heading else None,
                heading_color=post.heading.color if post.heading else None,
                title=post.title,
                author=AuthorInfo(),
                is_pinned=post.is_pinned,
                is_notice=post.is_notice,
                view_count=post.view_count,
                comment_count=post.comment_count,
                like_count=post.like_count,
                dislike_count=post.dislike_count,
                has_attachment=len(post.post_files) > 0,
                created_at=post.created_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return PostListResponse(
        posts=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/posts/hot", response_model=PostListResponse)
async def get_hot_posts(
    db: DbSession,
    current_user: VerifiedUser,
    limit: int = Query(10, ge=1, le=20),
):
    """인기 게시글 조회 (내가 접근 가능한 게시판에서 최근 7일 인기글)."""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # 사용자가 접근 가능한 게시판 조건:
    # 1. GLOBAL 게시판
    # 2. 사용자의 학교 SCHOOL 게시판
    # 3. 사용자의 학교가 접근 가능한 CUSTOM 게시판
    accessible_custom_board_ids = select(BoardAccessibleSchool.board_id).where(
        BoardAccessibleSchool.school_id == current_user.school_id
    )
    board_conditions = or_(
        Board.board_type == BoardType.GLOBAL,
        and_(Board.board_type == BoardType.SCHOOL, Board.school_id == current_user.school_id),
        and_(Board.board_type == BoardType.CUSTOM, Board.id.in_(accessible_custom_board_ids)),
    )

    result = await db.execute(
        select(Post)
        .join(Board, Post.board_id == Board.id)
        .where(
            Post.is_deleted == False,  # noqa: E712
            Post.is_hidden == False,  # noqa: E712
            Board.is_active == True,  # noqa: E712
            Post.created_at >= seven_days_ago,
            Post.like_count >= Board.hot_post_threshold,
            board_conditions,
        )
        .options(
            selectinload(Post.heading),
            selectinload(Post.post_files),
            selectinload(Post.board),
        )
        .order_by(Post.like_count.desc(), Post.view_count.desc())
        .limit(limit)
    )
    hot_posts = result.scalars().all()

    items = []
    for post in hot_posts:
        items.append(
            PostListItem(
                id=post.id,
                board_id=post.board_id,
                board_name=post.board.name if post.board else None,
                heading_id=post.heading_id,
                heading_name=post.heading.name if post.heading else None,
                heading_color=post.heading.color if post.heading else None,
                title=post.title,
                author=AuthorInfo(),
                is_pinned=post.is_pinned,
                is_notice=post.is_notice,
                view_count=post.view_count,
                comment_count=post.comment_count,
                like_count=post.like_count,
                dislike_count=post.dislike_count,
                has_attachment=len(post.post_files) > 0,
                created_at=post.created_at,
            )
        )

    return PostListResponse(
        posts=items,
        total=len(items),
        page=1,
        page_size=limit,
        total_pages=1,
    )


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: int, db: DbSession, current_user: VerifiedUser):
    """게시글 상세 조회."""
    result = await db.execute(
        select(Post)
        .where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
        .options(
            selectinload(Post.board).selectinload(Board.school),
            selectinload(Post.heading),
            selectinload(Post.post_files).selectinload(PostFile.file),
        )
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다",
        )

    # 권한 확인
    board = post.board
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
                    BoardAccessibleSchool.board_id == board.id,
                    BoardAccessibleSchool.school_id == current_user.school_id,
                )
            )
            if not result_bas.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="접근 권한이 없습니다",
                )

    # 숨김 처리된 글은 작성자 또는 관리자만 볼 수 있음
    if post.is_hidden and post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="숨김 처리된 게시글입니다",
        )

    # 조회수 증가
    post.view_count += 1

    author_info = await get_author_info(db, board, post.user_id, current_user.id, nickname=post.nickname)

    # 현재 사용자의 투표 상태 확인
    vote_result = await db.execute(
        select(PostVote.vote_type).where(
            PostVote.post_id == post.id,
            PostVote.user_id == current_user.id,
        )
    )
    my_vote_type = vote_result.scalar_one_or_none()
    my_vote = my_vote_type.value if my_vote_type else None

    # 스크랩 여부 확인
    scrap_result = await db.execute(
        select(Scrap).where(
            Scrap.post_id == post.id,
            Scrap.user_id == current_user.id,
        )
    )
    my_scrap = scrap_result.scalar_one_or_none() is not None

    files = [
        FileInfo(
            id=pf.file.id,
            original_name=pf.file.original_name,
            mime_type=pf.file.mime_type,
            size=pf.file.size,
            storage_key=pf.file.storage_key,
            thumb_key=pf.file.thumb_key,
            width=pf.file.width,
            height=pf.file.height,
        )
        for pf in sorted(post.post_files, key=lambda x: x.sort_order)
    ]

    # 관리자 여부 확인 (삭제 버튼 노출용)
    is_manager = False
    if current_user.is_admin:
        is_manager = True
    else:
        # 게시판 관리자 확인
        bm_result = await db.execute(
            select(BoardManager).where(
                BoardManager.board_id == post.board_id,
                BoardManager.user_id == current_user.id,
            )
        )
        is_manager = bm_result.scalar_one_or_none() is not None

    return PostResponse(
        id=post.id,
        board_id=post.board_id,
        heading_id=post.heading_id,
        heading_name=post.heading.name if post.heading else None,
        heading_color=post.heading.color if post.heading else None,
        title=post.title,
        body=post.body,
        author=author_info,
        is_pinned=post.is_pinned,
        is_notice=post.is_notice,
        is_hidden=post.is_hidden,
        view_count=post.view_count,
        comment_count=post.comment_count,
        like_count=post.like_count,
        dislike_count=post.dislike_count,
        my_vote=my_vote,
        my_scrap=my_scrap,
        is_manager=is_manager,
        files=files,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


@router.delete("/posts/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: int,
    request: Request,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시글 삭제 (본인 또는 관리자)."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다",
        )

    # 권한 확인 (본인 또는 관리자 또는 게시판 관리자)
    is_board_manager = False
    if post.user_id != current_user.id and not current_user.is_admin:
        # 게시판 관리자 확인
        bm_result = await db.execute(
            select(BoardManager).where(
                BoardManager.board_id == post.board_id,
                BoardManager.user_id == current_user.id,
            )
        )
        is_board_manager = bm_result.scalar_one_or_none() is not None
        if not is_board_manager:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="삭제 권한이 없습니다",
            )

    # 삭제 처리
    board_id_for_cache = post.board_id
    post.is_deleted = True

    # 감사 로그 (관리자가 삭제한 경우에만 남기거나, 중요한 작업이므로 항상 남길 수도 있음)
    if current_user.is_admin:
        await log_admin_action(
            db,
            admin_id=current_user.id,
            action="DELETE_POST",
            target_type="POST",
            target_id=post_id,
            details={"title": post.title, "author_id": post.user_id},
            ip_address=get_client_ip(request),
        )

    # --- Invalidate posts cache for this board ---
    await cache.delete_pattern(f"posts:{board_id_for_cache}:*")

    return MessageResponse(message="게시글이 삭제되었습니다")


@router.post("/posts/{post_id}/pin", response_model=MessageResponse)
async def pin_post(
    post_id: int,
    request_body: PinRequest,
    request: Request,
    db: DbSession,
    admin_user: AdminUser,
):
    """게시글 고정/공지 설정 (관리자 전용)."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다",
        )

    post.is_pinned = request_body.is_pinned
    post.is_notice = request_body.is_notice

    # 감사 로그
    await log_admin_action(
        db,
        admin_id=admin_user.id,
        action="PIN_POST",
        target_type="POST",
        target_id=post_id,
        details={"is_pinned": request_body.is_pinned, "is_notice": request_body.is_notice},
        ip_address=get_client_ip(request),
    )

    return MessageResponse(message="게시글 설정이 변경되었습니다")


@router.post("/posts/{post_id}/vote", response_model=VoteResponse)
async def vote_post(
    post_id: int,
    request: VoteRequest,
    db: DbSession,
    current_user: VerifiedUser,
):
    """
    게시글 좋아요/싫어요.

    - 같은 투표를 다시 하면 취소됨 (토글)
    - 반대 투표를 하면 기존 투표가 변경됨
    """
    # 게시글 조회
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다",
        )

    new_vote_type = VoteType(request.vote_type)

    # 기존 투표 확인
    result = await db.execute(
        select(PostVote).where(
            PostVote.post_id == post_id,
            PostVote.user_id == current_user.id,
        )
    )
    existing_vote = result.scalar_one_or_none()

    my_vote = None

    if existing_vote:
        if existing_vote.vote_type == new_vote_type:
            # 같은 투표 → 취소
            if existing_vote.vote_type == VoteType.LIKE:
                post.like_count = max(0, post.like_count - 1)
            else:
                post.dislike_count = max(0, post.dislike_count - 1)
            await db.delete(existing_vote)
            my_vote = None
        else:
            # 반대 투표 → 변경
            if existing_vote.vote_type == VoteType.LIKE:
                post.like_count = max(0, post.like_count - 1)
                post.dislike_count += 1
            else:
                post.dislike_count = max(0, post.dislike_count - 1)
                post.like_count += 1
            existing_vote.vote_type = new_vote_type
            my_vote = new_vote_type.value
    else:
        # 새 투표
        vote = PostVote(
            user_id=current_user.id,
            post_id=post_id,
            vote_type=new_vote_type,
        )
        db.add(vote)
        if new_vote_type == VoteType.LIKE:
            post.like_count += 1
        else:
            post.dislike_count += 1
        my_vote = new_vote_type.value

    await db.flush()

    return VoteResponse(
        like_count=post.like_count,
        dislike_count=post.dislike_count,
        my_vote=my_vote,
    )





@router.post("/posts/{post_id}/scrap", response_model=MessageResponse)
async def toggle_scrap(
    post_id: int,
    db: DbSession,
    current_user: VerifiedUser,
):
    """게시글 스크랩 토글."""
    # 게시글 존재 확인
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다",
        )

    # 기존 스크랩 확인
    result = await db.execute(
        select(Scrap).where(
            Scrap.user_id == current_user.id,
            Scrap.post_id == post_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        return MessageResponse(message="스크랩이 해제되었습니다")
    else:
        scrap = Scrap(user_id=current_user.id, post_id=post_id)
        db.add(scrap)
        return MessageResponse(message="게시글을 스크랩했습니다")



