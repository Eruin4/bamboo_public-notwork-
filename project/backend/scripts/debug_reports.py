import asyncio
import sys
import os

# Add parent directory to path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import async_session_factory
from app.models.board import Board
from app.models.report import Report
from app.models.post import Post

async def main():
    async with async_session_factory() as db:
        print("=== Boards ===")
        header = f"{'ID':<5} {'Type':<10} {'Name':<30}"
        print(header)
        print("-" * len(header))
        result = await db.execute(select(Board))
        boards = result.scalars().all()
        for b in boards:
            print(f"{b.id:<5} {b.board_type.value:<10} {b.name:<30}")

        print("\n=== Reports ===")
        header = f"{'ID':<5} {'Type':<10} {'TgtID':<5} {'BoardID':<8} {'Reason':<20}"
        print(header)
        print("-" * len(header))
        result = await db.execute(select(Report).order_by(Report.id.desc()))
        reports = result.scalars().all()
        for r in reports:
            print(f"{r.id:<5} {r.target_type.value:<10} {r.target_id:<5} {str(r.board_id):<8} {r.reason:<20}")

        print("\n=== Posts on Board 11 (Sample) ===")
        result = await db.execute(select(Post).where(Post.board_id == 11).limit(5))
        posts = result.scalars().all()
        for p in posts:
             print(f"Post {p.id}: {p.title}")

if __name__ == "__main__":
    asyncio.run(main())
