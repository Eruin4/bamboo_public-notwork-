"""
Database seed script.

Usage:
    python -m scripts.seed

Creates:
    - Sample schools with allowed domains
    - GLOBAL board
    - SCHOOL boards for each school
    - Default headings
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.db.session import async_session_factory
from app.models.school import School
from app.models.board import Board, BoardType
from app.models.heading import Heading


# Sample data
SCHOOLS = [
    {
        "name": "대구과학고등학교",
        "short_name": "대구과고",
        "allowed_domains": ["ts.hs.kr"],
        "description": "대구 소재 과학영재학교",
    },
]

DEFAULT_HEADINGS = [
    {"name": "일반", "color": "#6B7280", "sort_order": 0},
    {"name": "질문", "color": "#3B82F6", "sort_order": 1},
    {"name": "정보", "color": "#10B981", "sort_order": 2},
    {"name": "후기", "color": "#F59E0B", "sort_order": 3},
    {"name": "홍보", "color": "#8B5CF6", "sort_order": 4},
]


async def seed_schools(session) -> list[School]:
    """Create schools if not exist."""
    schools = []
    
    for school_data in SCHOOLS:
        result = await session.execute(
            select(School).where(School.name == school_data["name"])
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            print(f"  ⏭️ School already exists: {school_data['name']}")
            schools.append(existing)
        else:
            school = School(**school_data)
            session.add(school)
            await session.flush()
            print(f"  ✅ Created school: {school_data['name']}")
            schools.append(school)
    
    return schools


async def seed_global_board(session) -> Board:
    """Create global board if not exist."""
    result = await session.execute(
        select(Board).where(Board.board_type == BoardType.GLOBAL)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        print("  ⏭️ GLOBAL board already exists")
        return existing
    
    board = Board(
        name="전체 게시판",
        description="모든 학교 학생들이 함께하는 공간",
        board_type=BoardType.GLOBAL,
    )
    session.add(board)
    await session.flush()
    print("  ✅ Created GLOBAL board")
    return board


async def seed_school_boards(session, schools: list[School]) -> list[Board]:
    """Create school boards if not exist."""
    boards = []
    
    for school in schools:
        result = await session.execute(
            select(Board).where(
                Board.board_type == BoardType.SCHOOL,
                Board.school_id == school.id,
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            print(f"  ⏭️ School board already exists: {school.short_name}")
            boards.append(existing)
        else:
            board = Board(
                name=f"{school.short_name} 게시판",
                description=f"{school.name} 학생들의 공간",
                board_type=BoardType.SCHOOL,
                school_id=school.id,
            )
            session.add(board)
            await session.flush()
            print(f"  ✅ Created school board: {school.short_name}")
            boards.append(board)
    
    return boards


async def seed_headings(session, boards: list[Board]):
    """Create default headings for boards."""
    for board in boards:
        result = await session.execute(
            select(Heading).where(Heading.board_id == board.id)
        )
        existing = result.scalars().all()
        
        if existing:
            print(f"  ⏭️ Headings already exist for: {board.name}")
            continue
        
        for heading_data in DEFAULT_HEADINGS:
            heading = Heading(
                board_id=board.id,
                **heading_data,
            )
            session.add(heading)
        
        print(f"  ✅ Created headings for: {board.name}")


async def main():
    """Main seed function."""
    print("\n🌱 Starting database seed...")
    print("-" * 40)
    
    async with async_session_factory() as session:
        try:
            # Schools
            print("\n📚 Seeding schools...")
            schools = await seed_schools(session)
            
            # Global board
            print("\n🌐 Seeding global board...")
            global_board = await seed_global_board(session)
            
            # School boards
            print("\n🏫 Seeding school boards...")
            school_boards = await seed_school_boards(session, schools)
            
            # Headings
            print("\n📝 Seeding headings...")
            all_boards = [global_board] + school_boards
            await seed_headings(session, all_boards)
            
            await session.commit()
            
            print("\n" + "-" * 40)
            print("✅ Seed completed successfully!")
            print(f"   - Schools: {len(schools)}")
            print(f"   - Boards: {len(all_boards)}")
            print()
            
        except Exception as e:
            await session.rollback()
            print(f"\n❌ Seed failed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())

