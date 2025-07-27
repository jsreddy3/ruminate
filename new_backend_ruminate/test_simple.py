#!/usr/bin/env python3
"""
Simple integration test for conversation functionality.
Run directly without pytest to avoid asyncio complexities.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from new_backend_ruminate.infrastructure.db import bootstrap
from new_backend_ruminate.infrastructure.db.meta import Base
from new_backend_ruminate.config import settings
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.tests.stubs import StubLLM, StubContextBuilder
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.entities.message import Message


async def main():
    print("🔧 Setting up test environment...")
    
    # Initialize database
    await bootstrap.init_engine(settings())
    
    # Create service
    repo = RDSConversationRepository()
    llm = StubLLM()
    hub = EventStreamHub()
    ctx_builder = StubContextBuilder()
    svc = ConversationService(repo, llm, hub, ctx_builder)
    
    print("\n✅ Test 1: Create conversation")
    conv_id, root_id = await svc.create_conversation()
    print(f"   Created conversation {conv_id} with root message {root_id}")
    
    # Verify
    async with bootstrap.session_scope() as session:
        conv = await session.get(Conversation, conv_id)
        root = await session.get(Message, root_id)
        assert conv.root_message_id == root_id
        assert conv.active_thread_ids == [str(root_id)]
        print("   ✓ Conversation structure verified")
    
    print("\n✅ Test 2: Send message")
    from fastapi import BackgroundTasks
    bg = BackgroundTasks()
    user_id, ai_id = await svc.send_message(
        background=bg,
        conv_id=conv_id,
        user_content="Hello, AI!",
        parent_id=root_id,
    )
    print(f"   Created user message {user_id} and AI placeholder {ai_id}")
    
    # Execute background task synchronously
    for task in bg.tasks:
        await task.func(*task.args, **task.kwargs)
    
    # Verify
    async with bootstrap.session_scope() as session:
        ai_msg = await session.get(Message, ai_id)
        assert ai_msg.content == "foo bar"  # From StubLLM
        print("   ✓ AI response generated")
    
    print("\n✅ All tests passed!")
    
    # Cleanup
    await bootstrap.engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())