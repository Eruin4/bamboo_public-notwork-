"""
Report endpoints.
"""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, VerifiedUser
from app.models.report import Report, ReportTargetType
from app.models.post import Post
from app.models.comment import Comment
from app.schemas.report import ReportCreate, ReportResponse
from app.schemas.auth import MessageResponse

router = APIRouter()


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: ReportCreate,
    db: DbSession,
    current_user: VerifiedUser,
):
    """신고 접수."""
    # 대상 존재 확인
    target_type = ReportTargetType(request.target_type)
    board_id = None

    if target_type == ReportTargetType.POST:
        result = await db.execute(
            select(Post).where(
                Post.id == request.target_id,
                Post.is_deleted == False,  # noqa: E712
            )
        )
        target = result.scalar_one_or_none()
        if target:
            board_id = target.board_id
    else:
        result = await db.execute(
            select(Comment).where(
                Comment.id == request.target_id,
                Comment.is_deleted == False,  # noqa: E712
            )
        )
        target = result.scalar_one_or_none()
        if target:
            # Comment → Post → board_id
            post_result = await db.execute(
                select(Post).where(Post.id == target.post_id)
            )
            post = post_result.scalar_one_or_none()
            if post:
                board_id = post.board_id

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="신고 대상을 찾을 수 없습니다",
        )

    # 중복 신고 확인
    result = await db.execute(
        select(Report).where(
            Report.reporter_id == current_user.id,
            Report.target_type == target_type,
            Report.target_id == request.target_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 신고한 대상입니다",
        )

    # 신고 생성
    report = Report(
        reporter_id=current_user.id,
        target_type=target_type,
        target_id=request.target_id,
        board_id=board_id,
        reason=request.reason or "선택사항 없음",
        description=request.description,
    )
    db.add(report)

    return MessageResponse(message="신고가 접수되었습니다")
