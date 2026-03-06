"""
Admin endpoints.
"""
from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, AdminUser, get_client_ip
from app.models.report import Report, ReportStatus
from app.models.admin_audit_log import AdminAuditLog
from app.models.user import User
from app.models.school import School
from app.models.board import Board, BoardType
from app.models.heading import Heading
from app.models.domain_request import DomainRequest, DomainRequestStatus
from app.schemas.report import ReportResponse, ReportListResponse, ReportResolve
from app.schemas.admin import (
    AuditLogResponse,
    AuditLogListResponse,
    SchoolAdminResponse,
    SchoolListResponse,
    SchoolUpdate,
    SchoolCreate,
)
from app.schemas.domain_request import (
    DomainRequestResponse,
    DomainRequestListResponse,
    DomainRequestResolve,
)
from app.schemas.auth import MessageResponse
from app.services.audit import log_admin_action

# 새 학교 추가 시 기본 생성되는 글머리
DEFAULT_HEADINGS = [
    {"name": "일반", "color": "#6B7280", "sort_order": 0},
    {"name": "질문", "color": "#3B82F6", "sort_order": 1},
    {"name": "정보", "color": "#10B981", "sort_order": 2},
    {"name": "후기", "color": "#F59E0B", "sort_order": 3},
    {"name": "홍보", "color": "#8B5CF6", "sort_order": 4},
]

router = APIRouter()


@router.get("/reports", response_model=ReportListResponse)
async def get_reports(
    db: DbSession,
    admin_user: AdminUser,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """신고 목록 조회 (관리자 전용)."""
    conditions = []
    if status_filter:
        try:
            conditions.append(Report.status == ReportStatus(status_filter))
        except ValueError:
            pass

    # 전체 개수
    count_query = select(func.count(Report.id))
    if conditions:
        count_query = count_query.where(*conditions)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # 조회
    offset = (page - 1) * page_size
    query = select(Report).order_by(Report.created_at.desc()).offset(offset).limit(page_size)
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    reports = result.scalars().all()

    return ReportListResponse(
        reports=[
            ReportResponse(
                id=r.id,
                reporter_id=r.reporter_id,
                target_type=r.target_type.value,
                target_id=r.target_id,
                reason=r.reason,
                description=r.description,
                status=r.status.value,
                resolved_by_id=r.resolved_by_id,
                resolution_note=r.resolution_note,
                created_at=r.created_at,
            )
            for r in reports
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/reports/{report_id}", response_model=MessageResponse)
async def resolve_report(
    report_id: int,
    request_body: ReportResolve,
    request: Request,
    db: DbSession,
    admin_user: AdminUser,
):
    """신고 처리 (관리자 전용)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="신고를 찾을 수 없습니다",
        )

    try:
        new_status = ReportStatus(request_body.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 상태입니다",
        )

    report.status = new_status
    report.resolved_by_id = admin_user.id
    report.resolution_note = request_body.resolution_note

    # 감사 로그
    await log_admin_action(
        db,
        admin_id=admin_user.id,
        action="RESOLVE_REPORT",
        target_type="REPORT",
        target_id=report_id,
        details={"new_status": new_status.value, "note": request_body.resolution_note},
        ip_address=get_client_ip(request),
    )

    return MessageResponse(message="신고가 처리되었습니다")


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    db: DbSession,
    admin_user: AdminUser,
    action: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """감사 로그 조회 (관리자 전용)."""
    conditions = []
    if action:
        conditions.append(AdminAuditLog.action == action)

    # 전체 개수
    count_query = select(func.count(AdminAuditLog.id))
    if conditions:
        count_query = count_query.where(*conditions)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # 조회
    offset = (page - 1) * page_size
    query = (
        select(AdminAuditLog)
        .options(selectinload(AdminAuditLog.admin))
        .order_by(AdminAuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    logs = result.scalars().all()

    return AuditLogListResponse(
        logs=[
            AuditLogResponse(
                id=log.id,
                admin_id=log.admin_id,
                admin_email=log.admin.personal_email if log.admin else None,
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                details=log.details,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
            for log in logs
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# Domain Request Management
# ============================================

@router.get("/domain-requests", response_model=DomainRequestListResponse)
async def get_domain_requests(
    db: DbSession,
    admin_user: AdminUser,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """도메인 지원 요청 목록 조회 (관리자 전용)."""
    conditions = []
    if status_filter:
        try:
            conditions.append(DomainRequest.status == DomainRequestStatus(status_filter))
        except ValueError:
            pass

    count_query = select(func.count(DomainRequest.id))
    if conditions:
        count_query = count_query.where(*conditions)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    query = (
        select(DomainRequest)
        .options(selectinload(DomainRequest.requester))
        .order_by(DomainRequest.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    requests = result.scalars().all()

    return DomainRequestListResponse(
        requests=[
            DomainRequestResponse(
                id=r.id,
                requester_id=r.requester_id,
                requester_email=r.requester.personal_email if r.requester else None,
                school_name=r.school_name,
                school_short_name=r.school_short_name,
                email_domain=r.email_domain,
                description=r.description,
                status=r.status.value,
                admin_note=r.admin_note,
                resolved_by_id=r.resolved_by_id,
                created_at=r.created_at,
            )
            for r in requests
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/domain-requests/{request_id}", response_model=MessageResponse)
async def resolve_domain_request(
    request_id: int,
    request_body: DomainRequestResolve,
    request: Request,
    db: DbSession,
    admin_user: AdminUser,
):
    """
    도메인 요청 승인/거절 (관리자 전용).

    승인 시 자동으로:
    - 학교 생성 (이미 있으면 도메인만 추가)
    - 학교 게시판 생성
    - 기본 글머리 생성
    """
    result = await db.execute(
        select(DomainRequest).where(DomainRequest.id == request_id)
    )
    domain_req = result.scalar_one_or_none()

    if not domain_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="요청을 찾을 수 없습니다",
        )

    if domain_req.status != DomainRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 처리된 요청입니다",
        )

    try:
        new_status = DomainRequestStatus(request_body.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 상태입니다 (APPROVED 또는 REJECTED)",
        )

    domain_req.status = new_status
    domain_req.resolved_by_id = admin_user.id
    domain_req.admin_note = request_body.admin_note

    details = {
        "new_status": new_status.value,
        "school_name": domain_req.school_name,
        "email_domain": domain_req.email_domain,
        "note": request_body.admin_note,
    }

    if new_status == DomainRequestStatus.APPROVED:
        # 학교가 이미 있는지 확인
        result = await db.execute(
            select(School).where(School.name == domain_req.school_name)
        )
        existing_school = result.scalar_one_or_none()

        if existing_school:
            # 기존 학교에 도메인 추가
            if domain_req.email_domain not in [d.lower() for d in existing_school.allowed_domains]:
                existing_school.allowed_domains = [
                    *existing_school.allowed_domains,
                    domain_req.email_domain,
                ]
            school = existing_school
            details["action"] = "added_domain_to_existing_school"
        else:
            # 새 학교 생성
            school = School(
                name=domain_req.school_name,
                short_name=domain_req.school_short_name,
                allowed_domains=[domain_req.email_domain],
                description=domain_req.description,
            )
            db.add(school)
            await db.flush()

            details["action"] = "created_new_school"
            details["school_id"] = school.id

    # 감사 로그
    await log_admin_action(
        db,
        admin_id=admin_user.id,
        action="RESOLVE_DOMAIN_REQUEST",
        target_type="DOMAIN_REQUEST",
        target_id=request_id,
        details=details,
        ip_address=get_client_ip(request),
    )

    msg = "도메인 요청이 승인되었습니다" if new_status == DomainRequestStatus.APPROVED else "도메인 요청이 거절되었습니다"
    return MessageResponse(message=msg)


@router.delete("/domain-requests/{request_id}", response_model=MessageResponse)
async def delete_domain_request(
    request_id: int,
    db: DbSession,
    admin_user: AdminUser,
    request: Request,
):
    """도메인 지원 요청 삭제 (관리자 전용)."""
    result = await db.execute(
        select(DomainRequest).where(DomainRequest.id == request_id)
    )
    domain_req = result.scalar_one_or_none()

    if not domain_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="요청을 찾을 수 없습니다",
        )

    await db.delete(domain_req)

    # 감사 로그
    await log_admin_action(
        db,
        admin_id=admin_user.id,
        action="DELETE_DOMAIN_REQUEST",
        target_type="DOMAIN_REQUEST",
        target_id=request_id,
        details={
            "school_name": domain_req.school_name,
            "email_domain": domain_req.email_domain,
            "status": domain_req.status.value,
        },
        ip_address=get_client_ip(request),
    )

    return MessageResponse(message="도메인 요청이 삭제되었습니다")


# ============================================
# School Management
# ============================================

@router.get("/schools", response_model=SchoolListResponse)
async def get_schools(
    db: DbSession,
    admin_user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """학교 목록 조회 (관리자 전용)."""
    count_query = select(func.count(School.id))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    query = (
        select(School)
        .order_by(School.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    schools = result.scalars().all()

    return SchoolListResponse(
        schools=[
            SchoolAdminResponse(
                id=s.id,
                name=s.name,
                short_name=s.short_name,
                allowed_domains=s.allowed_domains,
                description=s.description,
                is_active=s.is_active,
                created_at=s.created_at,
            )
            for s in schools
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/schools", response_model=SchoolAdminResponse)
async def create_school(
    request_body: SchoolCreate,
    db: DbSession,
    admin_user: AdminUser,
    request: Request,
):
    """학교 생성 (관리자 전용)."""
    # 중복 확인
    result = await db.execute(select(School).where(School.name == request_body.name))
    if result.scalar_one_or_none():
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 학교 이름입니다",
        )
    
    # 학교 생성
    school = School(
        name=request_body.name,
        short_name=request_body.short_name,
        allowed_domains=request_body.allowed_domains,
        description=request_body.description,
        is_active=request_body.is_active,
    )
    db.add(school)
    await db.flush()
    await db.refresh(school)

    # 로그
    await log_admin_action(
        db,
        admin_id=admin_user.id,
        action="CREATE_SCHOOL",
        target_type="SCHOOL",
        target_id=school.id,
        details={
            "name": school.name,
            "short_name": school.short_name,
            "allowed_domains": school.allowed_domains
        },
        ip_address=get_client_ip(request),
    )

    return SchoolAdminResponse(
        id=school.id,
        name=school.name,
        short_name=school.short_name,
        allowed_domains=school.allowed_domains,
        description=school.description,
        is_active=school.is_active,
        created_at=school.created_at,
    )


@router.patch("/schools/{school_id}", response_model=SchoolAdminResponse)
async def update_school(
    school_id: int,
    request: SchoolUpdate,
    db: DbSession,
    admin_user: AdminUser,
    req: Request,
):
    """학교 정보 수정 (관리자 전용)."""
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalar_one_or_none()

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="학교를 찾을 수 없습니다",
        )

    updated_fields = {}
    if request.short_name is not None:
        school.short_name = request.short_name
        updated_fields["short_name"] = request.short_name
        
        # 학교 게시판 이름도 함께 업데이트
        result = await db.execute(
            select(Board).where(
                Board.school_id == school.id,
                Board.board_type == BoardType.SCHOOL
            )
        )
        school_board = result.scalar_one_or_none()
        if school_board:
            school_board.name = f"{request.short_name} 게시판"
            updated_fields["board_name_updated"] = school_board.name

    if request.is_active is not None:
        school.is_active = request.is_active
        updated_fields["is_active"] = request.is_active

    if request.allowed_domains is not None:
        school.allowed_domains = request.allowed_domains
        updated_fields["allowed_domains"] = request.allowed_domains

    if updated_fields:
        await log_admin_action(
            db,
            admin_id=admin_user.id,
            action="UPDATE_SCHOOL",
            target_type="SCHOOL",
            target_id=school_id,
            details=updated_fields,
            ip_address=get_client_ip(req),
        )

    return SchoolAdminResponse(
        id=school.id,
        name=school.name,
        short_name=school.short_name,
        allowed_domains=school.allowed_domains,
        description=school.description,
        is_active=school.is_active,
        created_at=school.created_at,
    )


@router.delete("/schools/{school_id}", response_model=MessageResponse)
async def delete_school(
    school_id: int,
    db: DbSession,
    admin_user: AdminUser,
    request: Request,
):
    """학교 삭제 (관리자 전용)."""
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalar_one_or_none()

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="학교를 찾을 수 없습니다",
        )

    # 학교 삭제
    # 명시적으로 연결된 게시판들을 먼저 삭제합니다.
    # Board 모델의 cascade 설정에 의존하기보다 명시적으로 삭제하여 확실하게 처리합니다.
    boards_result = await db.execute(select(Board).where(Board.school_id == school_id))
    boards = boards_result.scalars().all()
    for board in boards:
        await db.delete(board)
    
    # User의 school_id는 SET NULL로 설정됨 (DB 제약 조건).
    await db.delete(school)

    # 감사 로그
    await log_admin_action(
        db,
        admin_id=admin_user.id,
        action="DELETE_SCHOOL",
        target_type="SCHOOL",
        target_id=school_id,
        details={"name": school.name, "short_name": school.short_name},
        ip_address=get_client_ip(request),
    )

    return MessageResponse(message="학교가 삭제되었습니다")

