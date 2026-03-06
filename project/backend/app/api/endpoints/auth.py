"""
Authentication endpoints.
"""
import json
import hashlib
import secrets

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUser
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User, UserRole
from app.models.school import School
from app.models.domain_request import DomainRequest, DomainRequestStatus
from app.schemas.auth import (
    RegisterRequest,
    RegisterVerifyRequest,
    LoginRequest,
    UserUpdate,
    TokenResponse,
    OTPRequestSchema,
    OTPVerifySchema,
    UserResponse,
    MessageResponse,
    ChangePasswordRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.schemas.domain_request import DomainRequestCreate, DomainRequestResponse
from app.services.email import create_otp, verify_otp, send_otp_email, generate_otp

import redis.asyncio as aioredis

router = APIRouter()

REGISTER_OTP_PREFIX = "register_otp:"
REGISTER_DATA_PREFIX = "register_data:"
REGISTER_TTL = 600  # 10분
PASSWORD_RESET_PREFIX = "password_reset:"


def _email_key(email: str) -> str:
    """이메일을 해시키로 변환."""
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:32]


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def register(request: RegisterRequest, db: DbSession):
    """
    회원가입 1단계: 개인 이메일 인증 코드 발송.

    - 이메일 중복 확인
    - Redis에 임시 데이터 저장
    - 개인 이메일로 OTP 발송
    - DB에는 아직 사용자 미생성
    """
    # 이메일 중복 확인
    result = await db.execute(
        select(User).where(User.personal_email == request.personal_email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 이메일입니다",
        )

    # OTP 생성
    from app.services.email import generate_otp
    otp_code = generate_otp()

    # Redis 연결
    redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        key = _email_key(request.personal_email)

        # 임시 데이터 저장
        registration_data = {
            "personal_email": request.personal_email,
            "password": request.password,  # hash는 verify 시점에
            "nickname": request.nickname,
            "otp": otp_code,
            "attempts": 0,
        }
        await redis.setex(
            f"{REGISTER_DATA_PREFIX}{key}",
            REGISTER_TTL,
            json.dumps(registration_data),
        )
    finally:
        await redis.aclose()

    # OTP 이메일 발송
    await send_otp_email(request.personal_email, otp_code, purpose="회원가입")

    return MessageResponse(message="인증 코드가 발송되었습니다")


@router.post("/register/verify", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_verify(request: RegisterVerifyRequest, db: DbSession):
    """
    회원가입 2단계: OTP 검증 후 사용자 생성.

    - OTP 검증
    - DB에 사용자 생성
    - 토큰 발급
    """
    redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        key = _email_key(request.personal_email)
        data_key = f"{REGISTER_DATA_PREFIX}{key}"

        raw = await redis.get(data_key)
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="인증 요청이 만료되었거나 존재하지 않습니다. 다시 회원가입해주세요.",
            )

        registration_data = json.loads(raw)

        # 시도 횟수 체크
        if registration_data["attempts"] >= 5:
            await redis.delete(data_key)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="인증 시도 횟수를 초과했습니다. 다시 회원가입해주세요.",
            )

        # OTP 검증
        if registration_data["otp"] != request.otp:
            registration_data["attempts"] += 1
            await redis.setex(data_key, REGISTER_TTL, json.dumps(registration_data))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="잘못된 인증 코드입니다",
            )

        # 이메일 재확인 (동시 가입 방지)
        result = await db.execute(
            select(User).where(User.personal_email == registration_data["personal_email"])
        )
        if result.scalar_one_or_none():
            await redis.delete(data_key)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 등록된 이메일입니다",
            )

        # 사용자 생성
        user = User(
            personal_email=registration_data["personal_email"],
            password_hash=get_password_hash(registration_data["password"]),
            nickname=registration_data["nickname"],
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        # Redis 정리
        await redis.delete(data_key)
    finally:
        await redis.aclose()

    # 토큰 발급
    token = create_access_token(user.id)

    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: DbSession):
    """로그인."""
    result = await db.execute(
        select(User).where(User.personal_email == request.personal_email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다",
        )

    token = create_access_token(user.id)

    return TokenResponse(access_token=token)


@router.post("/school-email/request-otp", response_model=MessageResponse)
async def request_school_email_otp(
    request: OTPRequestSchema,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    학교 이메일 인증 OTP 요청.
    
    - 학교 이메일 도메인이 허용 목록에 있어야 함
    - OTP는 10분간 유효
    """
    # 이미 인증된 경우
    if current_user.school_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 학교 이메일이 인증되었습니다",
        )

    # 학교 이메일 중복 확인
    result = await db.execute(
        select(User).where(
            User.school_email == request.school_email,
            User.id != current_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 다른 계정에서 사용 중인 학교 이메일입니다",
        )

    # 도메인으로 학교 찾기
    email_domain = request.school_email.split("@")[1].lower()
    result = await db.execute(select(School).where(School.is_active == True))  # noqa: E712
    schools = result.scalars().all()

    matched_school = None
    for school in schools:
        if school.is_email_allowed(request.school_email):
            matched_school = school
            break

    if not matched_school:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 학교 이메일 도메인입니다",
        )

    # OTP 생성 및 발송
    code = await create_otp(db, current_user.id, request.school_email)
    await send_otp_email(request.school_email, code)

    return MessageResponse(message="인증 코드가 발송되었습니다")


@router.post("/school-email/verify-otp", response_model=MessageResponse)
async def verify_school_email_otp(
    request: OTPVerifySchema,
    db: DbSession,
    current_user: CurrentUser,
):
    """학교 이메일 OTP 검증."""
    if current_user.school_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 학교 이메일이 인증되었습니다",
        )

    # OTP 검증
    is_valid = await verify_otp(db, current_user.id, request.school_email, request.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잘못된 인증 코드이거나 만료되었습니다",
        )

    # 학교 찾기
    result = await db.execute(select(School).where(School.is_active == True))  # noqa: E712
    schools = result.scalars().all()

    matched_school = None
    for school in schools:
        if school.is_email_allowed(request.school_email):
            matched_school = school
            break

    if not matched_school:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 학교 이메일 도메인입니다",
        )

    # 사용자 정보 업데이트
    current_user.school_email = request.school_email
    current_user.school_email_verified = True
    current_user.school_id = matched_school.id

    return MessageResponse(message="학교 이메일이 인증되었습니다")


@router.post("/domain-request", response_model=DomainRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_domain_request(
    request: DomainRequestCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    도메인 지원 요청.

    지원하지 않는 학교 이메일 도메인인 경우,
    학교 정보를 입력하여 관리자에게 도메인 추가를 요청합니다.
    """
    # 이미 인증된 경우
    if current_user.school_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 학교 이메일이 인증되었습니다",
        )

    # 이미 같은 도메인으로 대기 중인 요청이 있는지 확인
    result = await db.execute(
        select(DomainRequest).where(
            DomainRequest.requester_id == current_user.id,
            DomainRequest.email_domain == request.email_domain.lower(),
            DomainRequest.status == DomainRequestStatus.PENDING,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 같은 도메인으로 대기 중인 요청이 있습니다",
        )

    # 이미 지원하는 도메인인지 확인
    result = await db.execute(select(School).where(School.is_active == True))  # noqa: E712
    schools = result.scalars().all()
    for school in schools:
        if request.email_domain.lower() in [d.lower() for d in school.allowed_domains]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"이미 지원하는 도메인입니다 ({school.name})",
            )

    domain_req = DomainRequest(
        requester_id=current_user.id,
        school_name=request.school_name,
        school_short_name=request.school_short_name,
        email_domain=request.email_domain.lower(),
        description=request.description,
    )
    db.add(domain_req)
    await db.flush()
    await db.refresh(domain_req)

    return DomainRequestResponse(
        id=domain_req.id,
        requester_id=domain_req.requester_id,
        requester_email=current_user.personal_email,
        school_name=domain_req.school_name,
        school_short_name=domain_req.school_short_name,
        email_domain=domain_req.email_domain,
        description=domain_req.description,
        status=domain_req.status.value,
        admin_note=domain_req.admin_note,
        resolved_by_id=domain_req.resolved_by_id,
        created_at=domain_req.created_at,
    )


@router.get("/domain-request/my", response_model=list[DomainRequestResponse])
async def get_my_domain_requests(
    db: DbSession,
    current_user: CurrentUser,
):
    """내 도메인 지원 요청 조회."""
    result = await db.execute(
        select(DomainRequest)
        .where(DomainRequest.requester_id == current_user.id)
        .order_by(DomainRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return [
        DomainRequestResponse(
            id=r.id,
            requester_id=r.requester_id,
            requester_email=current_user.personal_email,
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
    ]


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser, db: DbSession):
    """현재 사용자 정보 조회."""
    school_name = None
    if current_user.school_id:
        result = await db.execute(
            select(School.name).where(School.id == current_user.school_id)
        )
        school_name = result.scalar_one_or_none()

    return UserResponse(
        id=current_user.id,
        personal_email=current_user.personal_email,
        school_email=current_user.school_email,
        school_email_verified=current_user.school_email_verified,
        school_id=current_user.school_id,
        school_name=school_name,
        role=current_user.role.value,
        is_active=current_user.is_active,
        nickname=current_user.nickname,
    )


@router.patch("/me", response_model=UserResponse)
async def update_current_user_info(
    request: UserUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """현재 사용자 정보 수정."""
    if request.nickname is not None:
        current_user.nickname = request.nickname
    
    await db.flush()
    await db.refresh(current_user)
    
    school_name = None
    if current_user.school_id:
        result = await db.execute(
            select(School.name).where(School.id == current_user.school_id)
        )
        school_name = result.scalar_one_or_none()

    return UserResponse(
        id=current_user.id,
        personal_email=current_user.personal_email,
        school_email=current_user.school_email,
        school_email_verified=current_user.school_email_verified,
        school_id=current_user.school_id,
        school_name=school_name,
        role=current_user.role.value,
        is_active=current_user.is_active,
        nickname=current_user.nickname,
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    db: DbSession,
    current_user: CurrentUser,
):
    """
    회원 탈퇴.
    
    관리 중인 게시판(OWNER)이 있으면 탈퇴할 수 없습니다.
    계정을 비활성화하고 개인정보를 삭제합니다 (Soft Delete).
    """
    # 1. 게시판 관리자(OWNER) 권한 확인
    from app.models.board_manager import BoardManager, ManagerRole
    from app.models.board import Board

    result = await db.execute(
        select(BoardManager)
        .join(Board, Board.id == BoardManager.board_id)
        .where(
            BoardManager.user_id == current_user.id,
            BoardManager.role == ManagerRole.OWNER.value,
            Board.is_active == True,  # noqa: E712
        )
    )
    managed_board = result.scalars().first()
    
    if managed_board:
        # 어떤 게시판인지 확인하여 메시지에 포함하면 더 친절할 듯
        board = await db.get(Board, managed_board.board_id)
        board_name = board.name if board else "알 수 없음"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"관리 중인 게시판('{board_name}')이 있습니다. 게시판을 삭제하거나 소유권을 위임한 후 탈퇴해주세요.",
        )

    import time
    timestamp = int(time.time())
    
    # 개인정보 파기 (Soft Delete)
    # Unique constraint 충돌 방지를 위해 dummy email 설정
    current_user.personal_email = f"deleted_{current_user.id}_{timestamp}@bamboo.local"
    current_user.school_email = None
    current_user.school_email_verified = False
    current_user.school_id = None
    current_user.password_hash = "deleted"
    current_user.nickname = "탈퇴한 사용자"
    current_user.bio = None
    current_user.is_active = False
    
    await db.flush()



@router.patch("/me/password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    비밀번호 변경 (로그인 상태).
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 비밀번호가 일치하지 않습니다.",
        )
    
    current_user.password_hash = get_password_hash(payload.new_password)
    db.add(current_user)
    
    return MessageResponse(message="비밀번호가 변경되었습니다.")


@router.post("/password-reset/request", response_model=MessageResponse)
async def request_password_reset(
    payload: PasswordResetRequest,
    db: DbSession,
):
    """
    비밀번호 초기화 요청 (1단계).
    입력된 이메일이 존재하면 인증번호를 발송합니다.
    """
    result = await db.execute(
        select(User).where(User.personal_email == payload.personal_email, User.is_active == True) # noqa: E712
    )
    user = result.scalar_one_or_none()
    
    if user:
        # OTP 생성 및 저장
        otp = generate_otp()
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        key = f"{PASSWORD_RESET_PREFIX}{payload.personal_email}"
        await redis.set(key, otp, ex=REGISTER_TTL)
        
        # 이메일 발송
        await send_otp_email(payload.personal_email, otp, "비밀번호 초기화")
    
    # 보안을 위해 이메일 존재 여부와 관계없이 성공 메시지 반환
    return MessageResponse(message="인증번호가 발송되었습니다. (메일이 오지 않으면 가입된 이메일인지 확인해주세요)")


@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: DbSession,
):
    """
    비밀번호 초기화 확인 (2단계).
    인증번호가 일치하면 새 비밀번호로 변경합니다.
    """
    redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    key = f"{PASSWORD_RESET_PREFIX}{payload.personal_email}"
    saved_otp = await redis.get(key)
    
    if not saved_otp or saved_otp != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증번호가 올바르지 않거나 만료되었습니다.",
        )

    result = await db.execute(
        select(User).where(User.personal_email == payload.personal_email, User.is_active == True) # noqa: E712
    )
    user = result.scalar_one_or_none()
    
    if not user:
        # 드문 경우지만 OTP 검증 후 유저가 없을 수 있음 (삭제 등)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )
    
    user.password_hash = get_password_hash(payload.new_password)
    db.add(user)
    
    # OTP 삭제 (재사용 방지)
    await redis.delete(key)
    
    return MessageResponse(message="비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.")
