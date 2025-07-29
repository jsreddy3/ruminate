#!/usr/bin/env python3
"""
Test script for note generation feature.
Tests the complete flow from conversation to generated note.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.infrastructure.db.bootstrap import get_session
from new_backend_ruminate.dependencies import (
    get_conversation_service,
    get_document_service,
    get_llm_service
)
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.document.service import DocumentService


async def test_note_generation():
    """Test the note generation feature end-to-end"""
    
    # Test configuration
    CONVERSATION_ID = "bfc6bdee-fc6f-4382-9f11-0df4f31778f7"
    USER_ID = "test-user"  # You'll need to update this with a real user ID
    
    print(f"Testing note generation for conversation: {CONVERSATION_ID}")
    
    # Get services
    conv_service = get_conversation_service()
    doc_service = get_document_service()
    
    async for session in get_session():
        try:
            # Step 1: Get the conversation
            print("\n1. Fetching conversation...")
            conversation = await conv_service.get_conversation(CONVERSATION_ID, USER_ID, session)
            print(f"   ✓ Found conversation type: {conversation.type}")
            print(f"   ✓ Document ID: {conversation.document_id}")
            
            # Step 2: Get messages from the conversation
            print("\n2. Fetching conversation messages...")
            messages = await conv_service.get_latest_thread(CONVERSATION_ID, USER_ID, session)
            print(f"   ✓ Found {len(messages)} messages")
            
            # Show a preview of messages
            user_messages = [m for m in messages if str(m.role) == 'user']
            assistant_messages = [m for m in messages if str(m.role) == 'assistant']
            print(f"   ✓ User messages: {len(user_messages)}")
            print(f"   ✓ Assistant messages: {len(assistant_messages)}")
            
            if user_messages:
                print(f"\n   First user message preview:")
                print(f"   '{user_messages[0].content[:100]}...'")
            
            # Step 3: Find a block to attach the note to
            print("\n3. Finding a block to attach the note to...")
            # For testing, we'll need to get blocks from the document
            if not conversation.document_id:
                print("   ✗ ERROR: Conversation has no associated document!")
                return
            
            # Get document blocks
            from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
            doc_repo = RDSDocumentRepository()
            blocks = await doc_repo.get_blocks_by_document(conversation.document_id, session)
            
            if not blocks:
                print("   ✗ ERROR: No blocks found in document!")
                return
            
            # Use the first block for testing
            target_block = blocks[0]
            print(f"   ✓ Using block: {target_block.id}")
            print(f"   ✓ Block type: {target_block.block_type}")
            if target_block.html_content:
                print(f"   ✓ Block content preview: '{target_block.html_content[:100]}...'")
            
            # Step 4: Generate the note
            print("\n4. Generating note from conversation...")
            result = await doc_service.generate_note_from_conversation(
                conversation_id=CONVERSATION_ID,
                block_id=target_block.id,
                messages=messages,
                message_count=5,
                topic="Key insights from this conversation",
                user_id=USER_ID,
                session=session
            )
            
            print(f"   ✓ Note generated successfully!")
            print(f"   ✓ Note ID: {result['note_id']}")
            print(f"\n   Generated note content:")
            print("   " + "-" * 60)
            print(f"   {result['note']}")
            print("   " + "-" * 60)
            
            # Step 5: Verify the note was saved
            print("\n5. Verifying note was saved to block metadata...")
            updated_block = await doc_repo.get_block(target_block.id, session)
            
            if updated_block.metadata and 'annotations' in updated_block.metadata:
                generated_notes = [
                    ann for key, ann in updated_block.metadata['annotations'].items()
                    if key.startswith('generated-')
                ]
                print(f"   ✓ Found {len(generated_notes)} generated note(s) in block metadata")
                
                if generated_notes:
                    latest_note = generated_notes[-1]
                    print(f"   ✓ Note marked as generated: {latest_note.get('is_generated', False)}")
                    print(f"   ✓ Source conversation ID: {latest_note.get('source_conversation_id', 'N/A')}")
                    print(f"   ✓ Message count used: {latest_note.get('message_count', 'N/A')}")
                    print(f"   ✓ Topic: {latest_note.get('topic', 'N/A')}")
            else:
                print("   ✗ WARNING: No annotations found in block metadata")
            
            print("\n✅ Note generation test completed successfully!")
            
        except Exception as e:
            print(f"\n❌ ERROR during test: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
        finally:
            await session.close()


async def find_test_conversation():
    """Helper to find a suitable test conversation"""
    print("Finding test conversations...")
    
    conv_service = get_conversation_service()
    
    async for session in get_session():
        try:
            # This is a simplified search - in practice you'd need proper user auth
            from sqlalchemy import select
            from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
            
            stmt = select(Conversation).where(
                Conversation.document_id.isnot(None)
            ).limit(5)
            
            result = await session.execute(stmt)
            conversations = result.scalars().all()
            
            print(f"\nFound {len(conversations)} conversations with documents:")
            for conv in conversations:
                print(f"  - ID: {conv.id}")
                print(f"    Type: {conv.type}")
                print(f"    Document: {conv.document_id}")
                print(f"    User: {conv.user_id}")
                print()
                
        finally:
            await session.close()


if __name__ == "__main__":
    # Check if we have a conversation ID argument
    if len(sys.argv) > 1:
        if sys.argv[1] == "--find":
            asyncio.run(find_test_conversation())
        else:
            # Use provided conversation ID
            CONVERSATION_ID = sys.argv[1]
            asyncio.run(test_note_generation())
    else:
        # Use default conversation ID
        asyncio.run(test_note_generation())