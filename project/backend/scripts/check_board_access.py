import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import async_session_factory
from app.models.board import Board
from app.models.board_accessible_school import BoardAccessibleSchool
from app.models.school import School

async def main():
    async with async_session_factory() as db:
        print("=== Board 8 (SCHOOL) ===")
        b8 = await db.get(Board, 8)
        if b8:
            print(f"Name: {b8.name}, Type: {b8.board_type.value}, SchoolID: {b8.school_id}")
        else:
            print("Board 8 not found")

        print("\n=== Board 11 (CUSTOM) ===")
        result = await db.execute(
            select(Board)
            .where(Board.id == 11)
            .options(selectinload(Board.accessible_schools))
        )
        b11 = result.scalar_one_or_none()
        if b11:
            print(f"Name: {b11.name}, Type: {b11.board_type.value}, SchoolID: {b11.school_id}")
            print(f"Accessible Schools: {[bas.school_id for bas in b11.accessible_schools]}")
            
            # Check school names
            s_ids = [bas.school_id for bas in b11.accessible_schools]
            if s_ids:
                s_result = await db.execute(select(School).where(School.id.in_(s_ids)))
                schools = s_result.scalars().all()
                for s in schools:
                    print(f"  - {s.name} (ID: {s.id})")
        else:
            print("Board 11 not found")

if __name__ == "__main__":
    asyncio.run(main())
