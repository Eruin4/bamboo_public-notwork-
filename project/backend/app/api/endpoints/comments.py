"""
Comment endpoints.
"""
from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, VerifiedUser, AdminUser, get_client_ip
from app.models.board import Board, BoardType
from app.models.post import Post
from app.models.comment import Comment
from app.models.school import School
from app.models.vote import CommentVote, VoteType
from app.models.board_manager import BoardManager
from app.schemas.comment import CommentCreate, CommentResponse, CommentListResponse, MyCommentItem, MyCommentListResponse
from app.schemas.post import AuthorInfo, VoteRequest, VoteResponse
from app.schemas.auth import MessageResponse
from app.services.anon import get_or_create_anon_number, get_anon_number
from app.services.author_info import get_author_metadata_maps
from app.services.audit import log_admin_action

router = APIRouter()


async def get_comment_author_info(
    db,
    board: Board,
    author_id: int,
    current_user_id: int,
    post_author_id: int,
    nickname: str | None = None,
) -> AuthorInfo:
    """댓글 작성자 정보 생성."""
    anon_number = await get_anon_number(db, board.id, author_id)
    school_name = None

    if board.board_type == BoardType.GLOBAL:
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
        is_post_author=author_id == post_author_id,
    )





def build_comment_tree(
    comments: list[Comment],
    author_infos: dict[int, AuthorInfo],
    my_votes: dict[int, str | None] | None = None,
    can_delete_set: set[int] | None = None,
) -> list[CommentResponse]:
    """댓글 트리 구조로 변환."""
    comment_map = {}
    root_comments = []
    if my_votes is None:
        my_votes = {}
    if can_delete_set is None:
        can_delete_set = set()

    # 먼저 모든 댓글을 맵에 저장
    for comment in comments:
        response = CommentResponse(
            id=comment.id,
            post_id=comment.post_id,
            parent_id=comment.parent_id,
            body=comment.body if not comment.is_deleted else "[삭제된 댓글입니다]",
            author=author_infos.get(comment.id, AuthorInfo()),
            is_hidden=comment.is_hidden,
            is_deleted=comment.is_deleted,
            like_count=comment.like_count,
            dislike_count=comment.dislike_count,
            my_vote=my_votes.get(comment.id),
            can_delete=comment.id in can_delete_set,
            created_at=comment.created_at,
            replies=[],
        )
        comment_map[comment.id] = response

    # 트리 구조 생성
    for comment in comments:
        if comment.parent_id:
            parent = comment_map.get(comment.parent_id)
            if parent:
                parent.replies.append(comment_map[comment.id])
        else:
            root_comments.append(comment_map[comment.id])

    return root_comments


@router.get("/posts/{post_id}/comments", response_model=CommentListResponse)
async def get_comments(post_id: int, db: DbSession, current_user: VerifiedUser):
    """댓글 목록 조회."""
    # 게시글 조회
    result = await db.execute(
        select(Post)
        .where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
        .options(selectinload(Post.board))
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
        if board.school_id != current_user.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다",
            )

    # 댓글 조회
    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    visible_comments = [
        comment
        for comment in comments
        if not comment.is_hidden or comment.user_id == current_user.id or current_user.is_admin
    ]
    visible_author_ids = {comment.user_id for comment in visible_comments}
    anon_numbers, school_names = await get_author_metadata_maps(
        db,
        board.id,
        visible_author_ids,
        include_school_names=board.board_type == BoardType.GLOBAL,
    )

    # 작성자 정보 수집
    author_infos = {}
    for comment in visible_comments:
        author_infos[comment.id] = AuthorInfo(
            anon_number=anon_numbers.get(comment.user_id),
            school_name=school_names.get(comment.user_id),
            nickname=comment.nickname,
            is_author=comment.user_id == current_user.id,
            is_post_author=comment.user_id == post.user_id,
        )

    # 현재 사용자의 댓글 투표 상태 조회
    comment_ids = [c.id for c in comments]
    my_votes: dict[int, str | None] = {}
    if comment_ids:
        vote_result = await db.execute(
            select(CommentVote.comment_id, CommentVote.vote_type).where(
                CommentVote.comment_id.in_(comment_ids),
                CommentVote.user_id == current_user.id,
            )
        )
        for cid, vtype in vote_result.all():
            my_votes[cid] = vtype.value if vtype else None

    # 게시판 관리자 여부 확인 (can_delete 계산용)
    is_board_manager = current_user.is_admin
    if not is_board_manager:
        bm_result = await db.execute(
            select(BoardManager).where(
                BoardManager.board_id == board.id,
                BoardManager.user_id == current_user.id,
            )
        )
        is_board_manager = bm_result.scalar_one_or_none() is not None

    # can_delete 계산: 자기 댓글 OR 게시판 관리자 OR 전체 관리자
    can_delete_set: set[int] = set()
    for comment in comments:
        if not comment.is_deleted and (
            comment.user_id == current_user.id or is_board_manager
        ):
            can_delete_set.add(comment.id)

    # 트리 구조 생성
    comment_tree = build_comment_tree(comments, author_infos, my_votes, can_delete_set)

    return CommentListResponse(
        comments=comment_tree,
        total=len(comments),
    )


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: int,
    request: CommentCreate,
    db: DbSession,
    current_user: VerifiedUser,
):
    """
    댓글 작성.
    
    - 댓글 작성 시 익명 번호가 발급됨 (보드 단위)
    """
    # 게시글 조회
    result = await db.execute(
        select(Post)
        .where(Post.id == post_id, Post.is_deleted == False)  # noqa: E712
        .options(selectinload(Post.board))
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
        if board.school_id != current_user.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다",
            )

    # 부모 댓글 확인
    if request.parent_id:
        result = await db.execute(
            select(Comment).where(
                Comment.id == request.parent_id,
                Comment.post_id == post_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않은 부모 댓글입니다",
            )

    # 닉네임 처리
    comment_nickname = None
    if request.use_nickname and current_user.nickname:
        comment_nickname = current_user.nickname

    # 익명 번호 발급 (트랜잭션 내에서)
    anon_number = await get_or_create_anon_number(db, board.id, current_user.id)

    # 댓글 생성
    comment = Comment(
        post_id=post_id,
        user_id=current_user.id,
        parent_id=request.parent_id,
        body=request.body,
        nickname=comment_nickname,
    )
    db.add(comment)

    # 게시글 댓글 수 증가
    post.comment_count += 1

    await db.flush()
    await db.refresh(comment)

    # 작성자 정보
    school_name = None
    if board.board_type == BoardType.GLOBAL and current_user.school_id:
        result = await db.execute(
            select(School.short_name).where(School.id == current_user.school_id)
        )
        school_name = result.scalar_one_or_none()

    author_info = AuthorInfo(
        anon_number=anon_number,
        school_name=school_name,
        nickname=comment_nickname,
        is_author=True,
        is_post_author=current_user.id == post.user_id,
    )

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        parent_id=comment.parent_id,
        body=comment.body,
        author=author_info,
        is_hidden=comment.is_hidden,
        is_deleted=comment.is_deleted,
        like_count=0,
        dislike_count=0,
        my_vote=None,
        created_at=comment.created_at,
        replies=[],
    )


@router.delete("/comments/{comment_id}", response_model=MessageResponse)
async def delete_comment(
    comment_id: int,
    request: Request,
    db: DbSession,
    current_user: VerifiedUser,
):
    """댓글 삭제 (작성자, 게시판 관리자, 전체 관리자)."""
    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment_id, Comment.is_deleted == False)  # noqa: E712
        .options(selectinload(Comment.post))
    )
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="댓글을 찾을 수 없습니다",
        )

    # 권한 확인: 작성자 OR 게시판 관리자 OR 전체 관리자
    if comment.user_id != current_user.id and not current_user.is_admin:
        bm_result = await db.execute(
            select(BoardManager).where(
                BoardManager.board_id == comment.post.board_id,
                BoardManager.user_id == current_user.id,
            )
        )
        if bm_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="삭제 권한이 없습니다",
            )

    # 삭제 처리
    comment.is_deleted = True

    # 게시글 댓글 수 감소
    comment.post.comment_count = max(0, comment.post.comment_count - 1)

    # 감사 로그 (관리자·게시판 관리자가 삭제한 경우)
    if current_user.is_admin or comment.user_id != current_user.id:
        await log_admin_action(
            db,
            admin_id=current_user.id,
            action="DELETE_COMMENT",
            target_type="COMMENT",
            target_id=comment_id,
            details={"body_preview": comment.body[:100]},
            ip_address=get_client_ip(request),
        )

    return MessageResponse(message="댓글이 삭제되었습니다")


@router.post("/comments/{comment_id}/vote", response_model=VoteResponse)
async def vote_comment(
    comment_id: int,
    request: VoteRequest,
    db: DbSession,
    current_user: VerifiedUser,
):
    """
    댓글 좋아요/싫어요.

    - 같은 투표를 다시 하면 취소됨 (토글)
    - 반대 투표를 하면 기존 투표가 변경됨
    """
    # 댓글 조회
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.is_deleted == False)  # noqa: E712
    )
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="댓글을 찾을 수 없습니다",
        )

    new_vote_type = VoteType(request.vote_type)

    # 기존 투표 확인
    result = await db.execute(
        select(CommentVote).where(
            CommentVote.comment_id == comment_id,
            CommentVote.user_id == current_user.id,
        )
    )
    existing_vote = result.scalar_one_or_none()

    my_vote = None

    if existing_vote:
        if existing_vote.vote_type == new_vote_type:
            # 같은 투표 → 취소
            if existing_vote.vote_type == VoteType.LIKE:
                comment.like_count = max(0, comment.like_count - 1)
            else:
                comment.dislike_count = max(0, comment.dislike_count - 1)
            await db.delete(existing_vote)
            my_vote = None
        else:
            # 반대 투표 → 변경
            if existing_vote.vote_type == VoteType.LIKE:
                comment.like_count = max(0, comment.like_count - 1)
                comment.dislike_count += 1
            else:
                comment.dislike_count = max(0, comment.dislike_count - 1)
                comment.like_count += 1
            existing_vote.vote_type = new_vote_type
            my_vote = new_vote_type.value
    else:
        # 새 투표
        vote = CommentVote(
            user_id=current_user.id,
            comment_id=comment_id,
            vote_type=new_vote_type,
        )
        db.add(vote)
        if new_vote_type == VoteType.LIKE:
            comment.like_count += 1
        else:
            comment.dislike_count += 1
        my_vote = new_vote_type.value

    await db.flush()

    return VoteResponse(
        like_count=comment.like_count,
        dislike_count=comment.dislike_count,
        my_vote=my_vote,
    )


@router.get("/comments/my", response_model=MyCommentListResponse)
async def get_my_comments(
    db: DbSession,
    current_user: VerifiedUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """내가 쓴 댓글 목록 조회."""
    from app.models.board import Board

    conditions = [
        Comment.user_id == current_user.id,
        Comment.is_deleted == False,  # noqa: E712
    ]

    # 전체 개수
    count_result = await db.execute(
        select(func.count(Comment.id)).where(*conditions)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Comment)
        .where(*conditions)
        .options(
            selectinload(Comment.post).selectinload(Post.board),
        )
        .order_by(Comment.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    comments_list = result.scalars().all()

    items = []
    for comment in comments_list:
        post = comment.post
        items.append(
            MyCommentItem(
                id=comment.id,
                post_id=comment.post_id,
                post_title=post.title if post else None,
                board_id=post.board_id if post else None,
                board_name=post.board.name if post and post.board else None,
                body=comment.body,
                like_count=comment.like_count,
                dislike_count=comment.dislike_count,
                created_at=comment.created_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return MyCommentListResponse(
        comments=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
