"""
Admin audit log service.
"""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog


async def log_admin_action(
    db: AsyncSession,
    admin_id: int,
    action: str,
    target_type: str,
    target_id: int,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AdminAuditLog:
    """관리자 행동 로그 기록."""
    log = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    await db.flush()
    return log

