"""
Anonymous number service - 익명 번호 관리.
"""
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_alias import AuthorAlias


async def get_or_create_anon_number(
    db: AsyncSession,
    board_id: int,
    user_id: int,
) -> int:
    """
    보드 내 사용자의 익명 번호를 가져오거나 새로 생성.
    
    트랜잭션 안전하게 처리:
    - INSERT ... ON CONFLICT DO NOTHING + SELECT 방식
    """
    # 먼저 기존 번호 확인
    result = await db.execute(
        select(AuthorAlias.anon_number).where(
            AuthorAlias.board_id == board_id,
            AuthorAlias.user_id == user_id,
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing is not None:
        return existing

    # 새 번호 생성 (현재 최대값 + 1)
    max_result = await db.execute(
        select(func.coalesce(func.max(AuthorAlias.anon_number), 0)).where(
            AuthorAlias.board_id == board_id
        )
    )
    max_number = max_result.scalar() or 0
    new_number = max_number + 1

    # INSERT with conflict handling
    stmt = insert(AuthorAlias).values(
        board_id=board_id,
        user_id=user_id,
        anon_number=new_number,
    ).on_conflict_do_nothing(
        constraint="uq_author_alias_board_user"
    )
    await db.execute(stmt)
    await db.flush()

    # 다시 조회 (동시 요청으로 다른 번호가 할당되었을 수 있음)
    result = await db.execute(
        select(AuthorAlias.anon_number).where(
            AuthorAlias.board_id == board_id,
            AuthorAlias.user_id == user_id,
        )
    )
    return result.scalar_one()


async def get_anon_number(
    db: AsyncSession,
    board_id: int,
    user_id: int,
) -> int | None:
    """보드 내 사용자의 익명 번호 조회 (없으면 None)."""
    result = await db.execute(
        select(AuthorAlias.anon_number).where(
            AuthorAlias.board_id == board_id,
            AuthorAlias.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()

