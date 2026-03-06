"""
Email service - OTP 발송.
"""
import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.otp import OTPCode


def generate_otp() -> str:
    """6자리 OTP 코드 생성."""
    return "".join(random.choices(string.digits, k=6))


async def create_otp(
    db: AsyncSession,
    user_id: int,
    email: str,
) -> str:
    """OTP 코드 생성 및 저장."""
    # 기존 미사용 OTP 삭제
    await db.execute(
        delete(OTPCode).where(
            OTPCode.user_id == user_id,
            OTPCode.email == email,
            OTPCode.is_used == False,  # noqa: E712
        )
    )

    # 새 OTP 생성
    code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp = OTPCode(
        user_id=user_id,
        email=email,
        code=code,
        expires_at=expires_at,
    )
    db.add(otp)
    await db.flush()

    return code


async def verify_otp(
    db: AsyncSession,
    user_id: int,
    email: str,
    code: str,
) -> bool:
    """OTP 코드 검증."""
    result = await db.execute(
        select(OTPCode)
        .where(
            OTPCode.user_id == user_id,
            OTPCode.email == email,
            OTPCode.is_used == False,  # noqa: E712
        )
        .order_by(OTPCode.created_at.desc())
        .limit(1)
    )
    otp = result.scalar_one_or_none()

    if not otp:
        return False

    # 시도 횟수 증가
    otp.attempts += 1

    # 만료 또는 시도 초과
    if not otp.is_valid:
        return False

    # 코드 검증
    if otp.code != code:
        return False

    # 사용 처리
    otp.is_used = True
    return True


async def send_otp_email(email: str, code: str, purpose: str = "학교 이메일 인증") -> None:
    """OTP 이메일 발송."""
    if purpose == "회원가입":
        subject = "[Bamboo] 회원가입 인증 코드"
        purpose_text = "회원가입 인증 코드입니다."
    elif purpose == "비밀번호 초기화":
        subject = "[Bamboo] 비밀번호 초기화 인증 코드"
        purpose_text = "비밀번호 초기화 인증 코드입니다."
    else:
        subject = "[Bamboo] 학교 이메일 인증 코드"
        purpose_text = "학교 이메일 인증 코드입니다."

    if settings.EMAIL_MODE == "console":
        # 개발 모드: 콘솔 출력
        print("=" * 50)
        print(f"📧 OTP 발송 (개발 모드) - {purpose}")
        print(f"   대상: {email}")
        print(f"   코드: {code}")
        print("=" * 50)
    else:
        # SMTP 발송
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.SMTP_USER
        message["To"] = email

        text = f"""
Bamboo {purpose_text}

인증 코드: {code}

이 코드는 10분간 유효합니다.
본인이 요청하지 않았다면 이 이메일을 무시해주세요.
        """

        html = f"""
<html>
<body style="font-family: sans-serif; padding: 20px;">
    <h2 style="color: #10B981;">🎋 Bamboo</h2>
    <p>{purpose_text}</p>
    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">{code}</span>
    </div>
    <p style="color: #6B7280; font-size: 14px;">
        이 코드는 10분간 유효합니다.<br>
        본인이 요청하지 않았다면 이 이메일을 무시해주세요.
    </p>
</body>
</html>
        """

        message.attach(MIMEText(text, "plain"))
        message.attach(MIMEText(html, "html"))

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )


