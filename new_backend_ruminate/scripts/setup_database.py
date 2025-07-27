#!/usr/bin/env python3
"""
Database setup script for new_backend_ruminate.
Creates all tables from SQLAlchemy models.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from new_backend_ruminate.infrastructure.db import bootstrap
from new_backend_ruminate.infrastructure.db.meta import Base
from new_backend_ruminate.config import settings

# Import conversation models to register them with SQLAlchemy metadata
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.entities.message import Message


async def setup_database():
    """Initialize database engine and create all tables."""
    print("Setting up database...")
    print(f"Database URL: {settings().db_url}")
    
    try:
        # Initialize the engine
        await bootstrap.init_engine(settings())
        
        # Create all tables
        async with bootstrap.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)  # Optional: drop existing tables
            await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Database tables created successfully!")
        
        # Test the connection
        async with bootstrap.session_scope() as session:
            from sqlalchemy import text
            result = await session.execute(text("SELECT 1"))
            print("✅ Database connection test passed!")
            
    except Exception as e:
        print(f"❌ Error setting up database: {e}")
        raise
    finally:
        # Clean up
        if bootstrap.engine:
            await bootstrap.engine.dispose()


if __name__ == "__main__":
    asyncio.run(setup_database())