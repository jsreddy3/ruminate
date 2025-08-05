#!/usr/bin/env python3
"""
Script to flip the onboarding flag for users in local or production database.
Usage: python flip_onboarding_flag.py
"""

import asyncio
import os
import sys
from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from new_backend_ruminate.infrastructure.user.models import UserModel

# Load environment variables
load_dotenv()


class OnboardingFlagManager:
    def __init__(self, db_url: str):
        self.engine = create_async_engine(
            db_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10
        )
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def get_user_by_id(self, user_id: str) -> Optional[UserModel]:
        """Get user by ID."""
        async with self.async_session() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
            return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[UserModel]:
        """Get user by email."""
        async with self.async_session() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.email == email)
            )
            return result.scalar_one_or_none()

    async def flip_onboarding_flag(self, user_id: str) -> bool:
        """Toggle the onboarding flag for a user."""
        async with self.async_session() as session:
            # Get current user state
            user = await self.get_user_by_id(user_id)
            if not user:
                return False
            
            # Flip the flag
            new_value = not user.has_completed_onboarding
            await session.execute(
                update(UserModel)
                .where(UserModel.id == user_id)
                .values(has_completed_onboarding=new_value)
            )
            await session.commit()
            
            print(f"✓ User {user.email} onboarding flag changed: {user.has_completed_onboarding} → {new_value}")
            return True

    async def set_all_users_onboarded(self, onboarded: bool = True) -> int:
        """Set all users to onboarded or not onboarded."""
        async with self.async_session() as session:
            # Count users that will be updated
            result = await session.execute(
                select(UserModel).where(UserModel.has_completed_onboarding != onboarded)
            )
            users_to_update = len(result.scalars().all())
            
            # Update all users
            await session.execute(
                update(UserModel).values(has_completed_onboarding=onboarded)
            )
            await session.commit()
            
            status = "onboarded" if onboarded else "not onboarded"
            print(f"✓ Set all users to {status}. Updated {users_to_update} users.")
            return users_to_update

    async def list_users(self, limit: int = 20) -> List[UserModel]:
        """List users with their onboarding status."""
        async with self.async_session() as session:
            result = await session.execute(
                select(UserModel).limit(limit)
            )
            return result.scalars().all()

    async def close(self):
        """Close database connection."""
        await self.engine.dispose()


def get_database_urls():
    """Get database URLs from environment or config."""
    # Local database URL
    local_db_url = os.getenv('DB_URL')
    if not local_db_url:
        # Construct from individual components
        db_user = os.getenv('DB_USER', 'postgres')
        db_password = os.getenv('DB_PASSWORD', 'postgres')
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = os.getenv('DB_PORT', '5432')
        db_name = os.getenv('DB_NAME', 'ruminate')
        local_db_url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    # Production database URL (from commented values in .env)
    prod_db_url = "postgresql+asyncpg://postgres:Campfire123!@new-ruminate-cluster.cluster-crsosmiwisdr.us-west-1.rds.amazonaws.com:5432/postgres"
    
    return local_db_url, prod_db_url


async def main():
    local_db_url, prod_db_url = get_database_urls()
    
    print("🔧 Onboarding Flag Manager")
    print("=" * 50)
    
    # Select environment
    print("\nSelect environment:")
    print("1. Local database")
    print("2. Production database (⚠️  CAUTION)")
    
    while True:
        env_choice = input("\nEnter choice (1 or 2): ").strip()
        if env_choice in ['1', '2']:
            break
        print("Invalid choice. Please enter 1 or 2.")
    
    if env_choice == '1':
        db_url = local_db_url
        env_name = "LOCAL"
    else:
        db_url = prod_db_url
        env_name = "PRODUCTION"
        print("\n⚠️  WARNING: You are about to modify the PRODUCTION database!")
        confirm = input("Type 'CONFIRM' to proceed: ").strip()
        if confirm != 'CONFIRM':
            print("Operation cancelled.")
            return
    
    print(f"\n✓ Connected to {env_name} database")
    
    manager = OnboardingFlagManager(db_url)
    
    try:
        while True:
            print("\n" + "=" * 50)
            print("Options:")
            print("1. Flip onboarding flag by user ID")
            print("2. Flip onboarding flag by email")
            print("3. List users and their onboarding status")
            print("4. Set ALL users to onboarded (⚠️  BULK OPERATION)")
            print("5. Exit")
            
            choice = input("\nEnter choice (1-5): ").strip()
            
            if choice == '1':
                user_id = input("Enter user ID: ").strip()
                if user_id:
                    user = await manager.get_user_by_id(user_id)
                    if user:
                        print(f"\nUser found: {user.email}")
                        print(f"Current onboarding status: {user.has_completed_onboarding}")
                        confirm = input(f"Flip to {not user.has_completed_onboarding}? (y/n): ").strip().lower()
                        if confirm == 'y':
                            await manager.flip_onboarding_flag(user_id)
                    else:
                        print(f"❌ User with ID '{user_id}' not found.")
            
            elif choice == '2':
                email = input("Enter user email: ").strip()
                if email:
                    user = await manager.get_user_by_email(email)
                    if user:
                        print(f"\nUser found: {user.email} (ID: {user.id})")
                        print(f"Current onboarding status: {user.has_completed_onboarding}")
                        confirm = input(f"Flip to {not user.has_completed_onboarding}? (y/n): ").strip().lower()
                        if confirm == 'y':
                            await manager.flip_onboarding_flag(user.id)
                    else:
                        print(f"❌ User with email '{email}' not found.")
            
            elif choice == '3':
                print("\nUsers in database:")
                print("-" * 80)
                print(f"{'Email':<40} {'ID':<36} {'Onboarded'}")
                print("-" * 80)
                users = await manager.list_users()
                for user in users:
                    status = "✓" if user.has_completed_onboarding else "✗"
                    print(f"{user.email:<40} {user.id:<36} {status}")
                print(f"\nShowing {len(users)} users (limit: 20)")
            
            elif choice == '4':
                print(f"\n⚠️  WARNING: This will set ALL users in {env_name} to onboarded status!")
                print("This is a BULK operation that will affect ALL users in the database.")
                
                if env_name == "PRODUCTION":
                    confirm1 = input("\nType 'I UNDERSTAND' to continue: ").strip()
                    if confirm1 != 'I UNDERSTAND':
                        print("Operation cancelled.")
                        continue
                
                confirm2 = input(f"Are you absolutely sure you want to set ALL users to onboarded? (yes/no): ").strip().lower()
                if confirm2 == 'yes':
                    print("\nProcessing...")
                    count = await manager.set_all_users_onboarded(True)
                    print(f"\n✅ Successfully updated {count} users to onboarded status.")
                else:
                    print("Operation cancelled.")
            
            elif choice == '5':
                print("\nExiting...")
                break
            
            else:
                print("Invalid choice. Please try again.")
    
    finally:
        await manager.close()


if __name__ == "__main__":
    asyncio.run(main())