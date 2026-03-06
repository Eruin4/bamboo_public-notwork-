import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import async_session_factory
from app.models.board import Board, BoardType

async def main():
    async with async_session_factory() as db:
        print("Starting School Board Fix...")
        
        # 1. Promote Board 11 (Daegwak) to SCHOOL type
        result = await db.execute(select(Board).where(Board.id == 11))
        b11 = result.scalar_one_or_none()
        if b11:
            print(f"Found Board 11: {b11.name} ({b11.board_type})")
            b11.board_type = BoardType.SCHOOL
            b11.school_id = 7 # Daegu Science High School
            print("-> Promoted Board 11 to SCHOOL type (School ID 7)")
        else:
            print("Board 11 not found!")

        # 2. Deactivate Board 8 (Old Daegwak Board)
        result = await db.execute(select(Board).where(Board.id == 8))
        b8 = result.scalar_one_or_none()
        if b8:
            print(f"Found Board 8: {b8.name} ({b8.board_type})")
            b8.is_active = False
            print("-> Deactivated Board 8")
        else:
            print("Board 8 not found!")

        await db.commit()
        print("Changes committed.")

if __name__ == "__main__":
    asyncio.run(main())
