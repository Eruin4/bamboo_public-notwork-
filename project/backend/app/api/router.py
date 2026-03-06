"""
Main API router.
"""
from fastapi import APIRouter

from app.api.endpoints import auth, boards, posts, comments, uploads, reports, admin, board_manage, cons

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["인증"])
api_router.include_router(boards.router, prefix="/boards", tags=["게시판"])
api_router.include_router(posts.router, tags=["게시글"])
api_router.include_router(comments.router, tags=["댓글"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["업로드"])
api_router.include_router(reports.router, prefix="/reports", tags=["신고"])
api_router.include_router(admin.router, prefix="/admin", tags=["관리자"])
api_router.include_router(board_manage.router, tags=["게시판 관리"])
api_router.include_router(cons.router, tags=["콘(이모티콘)"])

