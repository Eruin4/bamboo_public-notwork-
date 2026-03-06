"""
Anonymous number system tests.
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.school import School
from app.models.board import Board, BoardType
from app.models.user import User
from app.core.security import get_password_hash
from app.services.anon import get_or_create_anon_number, get_anon_number


@pytest.mark.asyncio
async def test_anon_number_creation(test_db: AsyncSession):
    """Test anonymous number creation on first comment."""
    # Create test data
    school = School(
        name="Test School",
        short_name="테스트",
        allowed_domains=["test.hs.kr"],
    )
    test_db.add(school)
    await test_db.flush()
    
    board = Board(
        name="Test Board",
        board_type=BoardType.SCHOOL,
        school_id=school.id,
    )
    test_db.add(board)
    await test_db.flush()
    
    user = User(
        personal_email="anon@test.com",
        password_hash=get_password_hash("password"),
        school_id=school.id,
        school_email="anon@test.hs.kr",
        school_email_verified=True,
    )
    test_db.add(user)
    await test_db.flush()
    
    # Before creating comment, user has no anon number
    anon_before = await get_anon_number(test_db, board.id, user.id)
    assert anon_before is None
    
    # Create anon number (simulating comment creation)
    anon_number = await get_or_create_anon_number(test_db, board.id, user.id)
    assert anon_number == 1  # First user gets number 1
    
    # Getting again should return same number
    anon_number_again = await get_or_create_anon_number(test_db, board.id, user.id)
    assert anon_number_again == 1


@pytest.mark.asyncio
async def test_anon_number_sequential(test_db: AsyncSession):
    """Test that anonymous numbers are assigned sequentially."""
    # Create test data
    school = School(
        name="Test School 2",
        short_name="테스트2",
        allowed_domains=["test2.hs.kr"],
    )
    test_db.add(school)
    await test_db.flush()
    
    board = Board(
        name="Test Board 2",
        board_type=BoardType.SCHOOL,
        school_id=school.id,
    )
    test_db.add(board)
    await test_db.flush()
    
    # Create multiple users
    users = []
    for i in range(5):
        user = User(
            personal_email=f"user{i}@test.com",
            password_hash=get_password_hash("password"),
            school_id=school.id,
            school_email=f"user{i}@test2.hs.kr",
            school_email_verified=True,
        )
        test_db.add(user)
        users.append(user)
    await test_db.flush()
    
    # Assign anon numbers in order
    for i, user in enumerate(users):
        anon_number = await get_or_create_anon_number(test_db, board.id, user.id)
        assert anon_number == i + 1  # 1, 2, 3, 4, 5


@pytest.mark.asyncio
async def test_anon_number_board_isolation(test_db: AsyncSession):
    """Test that anonymous numbers are isolated per board."""
    # Create school
    school = School(
        name="Test School 3",
        short_name="테스트3",
        allowed_domains=["test3.hs.kr"],
    )
    test_db.add(school)
    await test_db.flush()
    
    # Create two boards
    board1 = Board(
        name="Board 1",
        board_type=BoardType.SCHOOL,
        school_id=school.id,
    )
    board2 = Board(
        name="Board 2",
        board_type=BoardType.GLOBAL,
    )
    test_db.add_all([board1, board2])
    await test_db.flush()
    
    # Create user
    user = User(
        personal_email="isolation@test.com",
        password_hash=get_password_hash("password"),
        school_id=school.id,
        school_email="isolation@test3.hs.kr",
        school_email_verified=True,
    )
    test_db.add(user)
    await test_db.flush()
    
    # Get anon number in board 1
    anon1 = await get_or_create_anon_number(test_db, board1.id, user.id)
    
    # Get anon number in board 2 - should be independent
    anon2 = await get_or_create_anon_number(test_db, board2.id, user.id)
    
    # Both should be 1 (first in their respective boards)
    assert anon1 == 1
    assert anon2 == 1

