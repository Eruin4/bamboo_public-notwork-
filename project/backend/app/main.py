"""
Bamboo Community Backend - FastAPI Application
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.redis import cache as redis_cache
from app.api.router import api_router

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"🎋 Bamboo Backend starting... (env: {settings.ENVIRONMENT})")
    
    # DB 연결 테스트
    try:
        from app.db.session import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("✅ Database connected")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")
    
    # Admin 계정 생성/승격
    if settings.ADMIN_PERSONAL_EMAIL:
        try:
            from app.db.session import async_session_factory
            from app.models.user import User, UserRole
            from sqlalchemy import select, update
            
            async with async_session_factory() as session:
                result = await session.execute(
                    select(User).where(User.personal_email == settings.ADMIN_PERSONAL_EMAIL)
                )
                admin = result.scalar_one_or_none()
                
                if admin:
                    if admin.role != UserRole.ADMIN:
                        admin.role = UserRole.ADMIN
                        await session.commit()
                        print(f"✅ Admin promoted: {settings.ADMIN_PERSONAL_EMAIL}")
                    else:
                        print(f"ℹ️ Admin already exists: {settings.ADMIN_PERSONAL_EMAIL}")
                else:
                    print(f"ℹ️ Admin email not registered yet: {settings.ADMIN_PERSONAL_EMAIL}")
        except Exception as e:
            print(f"⚠️ Admin setup failed: {e}")
    
    # Redis cache
    await redis_cache.initialize()
    
    yield
    
    # Shutdown
    await redis_cache.close()
    print("🎋 Bamboo Backend shutting down...")


app = FastAPI(
    title="Bamboo API",
    description="고교 전용 익명 커뮤니티 API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    if settings.DEBUG:
        import traceback
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": str(exc),
                "traceback": traceback.format_exc(),
            },
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "서버 오류가 발생했습니다"},
    )


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "bamboo-api"}


# Root
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "🎋 Bamboo Community API",
        "version": "0.1.0",
        "docs": "/docs" if settings.DEBUG else None,
    }


# Include API router
app.include_router(api_router)
