"""
Helpers for resolving author metadata in batches.
"""
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_alias import AuthorAlias
from app.models.school import School
from app.models.user import User


async def get_author_metadata_maps(
    db: AsyncSession,
    board_id: int,
    user_ids: Iterable[int],
    *,
    include_school_names: bool = True,
) -> tuple[dict[int, int], dict[int, str | None]]:
    """Return per-user anonymous numbers and school names for a board."""
    unique_user_ids = list(dict.fromkeys(user_ids))
    if not unique_user_ids:
        return {}, {}

    alias_result = await db.execute(
        select(AuthorAlias.user_id, AuthorAlias.anon_number).where(
            AuthorAlias.board_id == board_id,
            AuthorAlias.user_id.in_(unique_user_ids),
        )
    )
    anon_numbers = {
        user_id: anon_number
        for user_id, anon_number in alias_result.all()
    }

    school_names: dict[int, str | None] = {}
    if include_school_names:
        school_result = await db.execute(
            select(User.id, School.short_name)
            .select_from(User)
            .outerjoin(School, User.school_id == School.id)
            .where(User.id.in_(unique_user_ids))
        )
        school_names = {
            user_id: school_name
            for user_id, school_name in school_result.all()
        }

    return anon_numbers, school_names
