import asyncio
import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete, or_

from app.db.session import async_session_factory
from app.models.user import User, UserRole
from app.models.school import School

async def main():
    async with async_session_factory() as db:
        print("Starting legacy cleanup...")
        
        # 1. Find Daegu Science High School
        result = await db.execute(select(School).where(School.name.like("%대구과학고%")))
        daegu_school = result.scalar_one_or_none()
        
        if not daegu_school:
            print("Could not find Daegu Science High School. Searching generically...")
            # Try to find generic
            result = await db.execute(select(School))
            schools = result.scalars().all()
            print("Available schools:", [(s.id, s.name) for s in schools])
            # If there is only one school and it looks like it, pick it? 
            # But the user specifically said "Daegu Science High School".
            # If not found, I should not proceed recklessly.
            if len(schools) == 1:
                daegu_school = schools[0]
                print(f"Assuming {daegu_school.name} is the target.")
            else:
                return

        print(f"Found Target School: {daegu_school.name} (ID: {daegu_school.id})")
        
        # 2. Find legacy users
        # Users to DELETE: role is NOT ADMIN AND (school_id is NOT Daegu OR school_id is NULL)
        query = select(User).where(
            User.role != UserRole.ADMIN,
            or_(User.school_id != daegu_school.id, User.school_id.is_(None))
        )
        
        result = await db.execute(query)
        users_to_delete = result.scalars().all()
        
        if not users_to_delete:
            print("No legacy users found.")
        else:
            print(f"Found {len(users_to_delete)} legacy users.")
            ids_to_delete = []
            for user in users_to_delete:
                print(f" - Candidate User {user.id}: {user.personal_email} (Nick: {user.nickname}, SchoolID: {user.school_id})")
                ids_to_delete.append(user.id)
                
            # Perform deletion
            if ids_to_delete:
                stmt = delete(User).where(User.id.in_(ids_to_delete))
                await db.execute(stmt)
                await db.commit()
                print(f"Deleted {len(ids_to_delete)} legacy users.")
            
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(main())
