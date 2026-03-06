import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete
from app.db.session import async_session_factory
from app.models.school import School
from app.models.board import Board

TARGET_SCHOOL_NAME = "대구과학고등학교"

async def main():
    print(f"🧹 Starting cleanup... preserving {TARGET_SCHOOL_NAME}")
    
    async with async_session_factory() as session:
        try:
            # 1. Find all schools EXCEPT the target one
            stmt = select(School).where(School.name != TARGET_SCHOOL_NAME)
            result = await session.execute(stmt)
            schools_to_delete = result.scalars().all()
            
            if not schools_to_delete:
                print("✅ No other schools found to delete.")
                return

            print(f"found {len(schools_to_delete)} schools to delete:")
            for s in schools_to_delete:
                print(f" - {s.name}")

            # 2. Delete them
            # We can use delete statement directly
            delete_stmt = delete(School).where(School.name != TARGET_SCHOOL_NAME)
            await session.execute(delete_stmt)
            
            await session.commit()
            print("✅ Cleanup complete.")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Cleanup failed: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(main())
