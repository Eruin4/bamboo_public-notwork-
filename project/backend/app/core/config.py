"""
Application configuration using Pydantic Settings.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ============================================
    # Database
    # ============================================
    DATABASE_URL: str = "postgresql+asyncpg://bamboo:bamboo@localhost:5432/bamboo"
    DATABASE_URL_SYNC: str = "postgresql://bamboo:bamboo@localhost:5432/bamboo"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True

    # ============================================
    # Redis
    # ============================================
    REDIS_URL: str = "redis://localhost:6379/0"

    # ============================================
    # Security
    # ============================================
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ============================================
    # Admin
    # ============================================
    ADMIN_PERSONAL_EMAIL: str = ""

    # ============================================
    # Upload
    # ============================================
    UPLOAD_DIR: str = "/data/uploads"
    THUMB_DIR: str = "/data/thumbs"
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_FILE_SIZE_MB: int = 10
    MAX_IMAGE_RESOLUTION: int = 2560
    THUMB_MAX_SIZE: int = 512
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp"]
    ALLOWED_FILE_TYPES: List[str] = [
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
        "application/x-rar-compressed",
        "text/plain",
        "application/x-hwp",
        "application/haansofthwp",
    ]

    # ============================================
    # Email
    # ============================================
    EMAIL_MODE: str = "console"  # "console" or "smtp"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # ============================================
    # Application
    # ============================================
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # ============================================
    # Rate Limiting
    # ============================================
    RATE_LIMIT_PER_MINUTE: int = 60


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()

