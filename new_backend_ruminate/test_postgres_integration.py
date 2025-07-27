#!/usr/bin/env python3
"""
PostgreSQL Integration Test

This script tests the database operations against a real PostgreSQL instance
to ensure compatibility before deploying to production.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from new_backend_ruminate.infrastructure.db import bootstrap
from new_backend_ruminate.infrastructure.db.meta import Base
from new_backend_ruminate.domain.conversation.entities import Conversation, Message
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import (
    RDSConversationRepository
)


async def test_postgres_connection():
    """Test basic PostgreSQL connectivity and operations."""
    
    # PostgreSQL connection URL - using local container
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    
    print("1. Testing PostgreSQL connection...")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    try:
        # Test basic connection
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
            print("✓ PostgreSQL connection successful")
            
            # Check PostgreSQL version
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✓ PostgreSQL version: {version}")
    except Exception as e:
        print(f"✗ Failed to connect to PostgreSQL: {e}")
        return False
    
    print("\n2. Creating database schema...")
    try:
        # Drop existing tables to ensure clean state
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.commit()
        
        # Create all tables using Base metadata
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✓ Database schema created successfully")
    except Exception as e:
        print(f"✗ Failed to create schema: {e}")
        return False
    
    print("\n3. Testing repository operations...")
    # Create async session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        repo = RDSConversationRepository()
        
        try:
            # Test creating a conversation
            conv = Conversation(id="test-conv-1")
            await repo.create(conv, session)
            await session.commit()
            print("✓ Created conversation successfully")
            
            # Test retrieving the conversation
            retrieved = await repo.get("test-conv-1", session)
            assert retrieved is not None
            assert retrieved.id == "test-conv-1"
            print("✓ Retrieved conversation successfully")
            
            # Test creating a message
            msg = Message(
                conversation_id="test-conv-1",
                content="Test message in PostgreSQL",
                role="USER"  # Must be uppercase
            )
            session.add(msg)
            await session.commit()
            print("✓ Created message successfully")
            
            # Test getting latest thread using the fixed CTE
            messages = await repo.latest_thread("test-conv-1", session)
            assert len(messages) == 1
            assert messages[0].content == "Test message in PostgreSQL"
            print("✓ Retrieved messages successfully using latest_thread CTE")
            
            # Test listing conversations
            stmt = select(Conversation)
            result = await session.execute(stmt)
            convs = result.scalars().all()
            assert len(convs) == 1
            print("✓ Listed conversations successfully")
            
        except Exception as e:
            print(f"✗ Repository operation failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    print("\n4. Testing database constraints...")
    async with async_session() as session:
        try:
            # Test foreign key constraint
            msg = Message(
                conversation_id="non-existent-conv",
                content="This should fail",
                role="USER"
            )
            session.add(msg)
            await session.commit()
            print("✗ Foreign key constraint not working!")
            return False
        except Exception:
            print("✓ Foreign key constraints working correctly")
    
    await engine.dispose()
    print("\n✅ All PostgreSQL integration tests passed!")
    return True


async def main():
    """Run the PostgreSQL integration test."""
    success = await test_postgres_connection()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())