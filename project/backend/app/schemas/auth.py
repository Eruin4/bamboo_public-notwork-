"""
Auth schemas.
"""
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """회원가입 요청 (1단계: OTP 발송)."""
    personal_email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    nickname: str = Field(..., min_length=1, max_length=50)


class RegisterVerifyRequest(BaseModel):
    """회원가입 OTP 검증 (2단계)."""
    personal_email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class LoginRequest(BaseModel):
    """로그인 요청."""
    personal_email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """사용자 정보 수정."""
    nickname: str | None = Field(None, min_length=1, max_length=50)


class TokenResponse(BaseModel):
    """토큰 응답."""
    access_token: str
    token_type: str = "bearer"


class OTPRequestSchema(BaseModel):
    """OTP 요청."""
    school_email: EmailStr


class OTPVerifySchema(BaseModel):
    """OTP 검증."""
    school_email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class UserResponse(BaseModel):
    """사용자 정보 응답."""
    id: int
    personal_email: str
    school_email: str | None
    school_email_verified: bool
    school_id: int | None
    school_name: str | None = None
    role: str
    is_active: bool
    nickname: str | None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """일반 메시지 응답."""
    message: str


class ChangePasswordRequest(BaseModel):
    """비밀번호 변경 요청."""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class PasswordResetRequest(BaseModel):
    """비밀번호 초기화 요청 (1단계)."""
    personal_email: EmailStr


class PasswordResetConfirm(BaseModel):
    """비밀번호 초기화 확인 (2단계)."""
    personal_email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=100)

