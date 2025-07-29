#!/usr/bin/env python3
"""Debug script to understand context building flow"""

import asyncio
from fastapi import BackgroundTasks
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.tests.stubs import StubLLM

async def debug_context_flow():
    """Debug the actual context building flow"""
    repo = RDSConversationRepository()
    llm = StubLLM()
    hub = EventStreamHub()
    ctx_builder = ContextBuilder()
    
    svc = ConversationService(repo, llm, hub, ctx_builder)
    
    print("=== Testing Context Building Flow ===")
    
    # Create conversation
    conv_id, root_id = await svc.create_conversation(user_id="test-user")
    print(f"Created conversation: {conv_id}, root: {root_id}")
    
    async with session_scope() as session:
        # Get the conversation and root message
        conv = await repo.get(conv_id, session)
        root = await repo.get_message(root_id, session)
        print(f"Conversation type: {conv.type}")
        print(f"Root message role: {root.role}, content: {root.content[:50]}...")
        
        # Test context building with just root message
        thread = await repo.latest_thread(conv_id, session)
        print(f"Initial thread length: {len(thread)}")
        for i, msg in enumerate(thread):
            print(f"  {i}: {msg.role} - {msg.content[:50]}...")
        
        # Build context from just root message
        context = await ctx_builder.build(conv, thread, session=session)
        print(f"\nContext built from root only:")
        for i, msg in enumerate(context):
            print(f"  {i}: {msg['role']} - {msg['content'][:50]}...")
    
    # Send first user message
    bg = BackgroundTasks()
    user_id_1, ai_id_1 = await svc.send_message(
        background=bg,
        conv_id=conv_id,
        user_content="Hello, this is my first message",
        parent_id=root_id,
        user_id="test-user"
    )
    print(f"\nSent first message: user={user_id_1}, ai={ai_id_1}")
    
    # Execute background tasks
    for task in bg.tasks:
        await task.func(*task.args, **task.kwargs)
    
    async with session_scope() as session:
        # Check thread after first exchange
        thread = await repo.latest_thread(conv_id, session)
        print(f"\nThread after first exchange (length: {len(thread)}):")
        for i, msg in enumerate(thread):
            print(f"  {i}: {msg.role} - {msg.content[:50]}...")
        
        # Build context after first exchange
        context = await ctx_builder.build(conv, thread, session=session)
        print(f"\nContext after first exchange:")
        for i, msg in enumerate(context):
            print(f"  {i}: {msg['role']} - {msg['content'][:50]}...")
    
    # Send second user message
    bg = BackgroundTasks()
    user_id_2, ai_id_2 = await svc.send_message(
        background=bg,
        conv_id=conv_id,
        user_content="This is my second message, can you remember the first?",
        parent_id=ai_id_1,
        user_id="test-user"
    )
    print(f"\nSent second message: user={user_id_2}, ai={ai_id_2}")
    
    # Execute background tasks
    for task in bg.tasks:
        await task.func(*task.args, **task.kwargs)
    
    async with session_scope() as session:
        # Check thread after second exchange
        thread = await repo.latest_thread(conv_id, session)
        print(f"\nFinal thread (length: {len(thread)}):")
        for i, msg in enumerate(thread):
            print(f"  {i}: {msg.role} - {msg.content[:50]}...")
        
        # Build context for second message (this is what would be sent to LLM)
        context = await ctx_builder.build(conv, thread, session=session)
        print(f"\nFinal context sent to LLM:")
        for i, msg in enumerate(context):
            print(f"  {i}: {msg['role']} - {msg['content'][:50]}...")
            
        print(f"\nFull context messages:")
        for i, msg in enumerate(context):
            print(f"  {i}: {msg['role']} - {msg['content']}")

if __name__ == "__main__":
    asyncio.run(debug_context_flow())