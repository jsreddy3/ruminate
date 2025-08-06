#!/usr/bin/env python3
"""
Test script for prompt approval debug mode
"""
import asyncio
import aiohttp
import json
from datetime import datetime

# Configuration
API_BASE = "http://localhost:8000"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NDQwZjY2NC01ZjA0LTQyNjgtYWI4ZC1hNjAyOWVkNGViNGEiLCJnb29nbGVfaWQiOiIxMDc3NjQ1NDQwMjQwNTU2NDk0NzMiLCJlbWFpbCI6ImphaWRlbnJlZGR5QGdtYWlsLmNvbSIsIm5hbWUiOiJKYWlkZW4gUmVkZHkiLCJpYXQiOjE3NTQ0MzczMDQsImV4cCI6MTc1NDUyMzcwNH0._mhQ5qHCRsmczGz3UDA4aIBDZVkgQ7J-xNWcdk7OipY"

async def test_debug_mode():
    async with aiohttp.ClientSession() as session:
        # 1. First, let's create a test conversation
        print("1. Creating test conversation...")
        async with session.post(
            f"{API_BASE}/conversations",
            headers={
                "Authorization": f"Bearer {AUTH_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"type": "CHAT"}
        ) as resp:
            if resp.status == 401:
                print("❌ Authentication failed. Please update AUTH_TOKEN in this script.")
                print("   You can find your token in browser DevTools > Network > Request Headers")
                return
            
            conv_data = await resp.json()
            conv_id = conv_data.get("conversation_id")
            print(f"✅ Created conversation: {conv_id}")
        
        # 2. Send a message WITH debug mode
        print("\n2. Sending message with debug mode enabled...")
        async with session.post(
            f"{API_BASE}/conversations/{conv_id}/messages",
            headers={
                "Authorization": f"Bearer {AUTH_TOKEN}",
                "Content-Type": "application/json",
                "X-Debug-Mode": "true"  # This enables debug mode!
            },
            json={
                "content": "What is the meaning of life?",
                "parent_id": None
            }
        ) as resp:
            msg_data = await resp.json()
            ai_msg_id = msg_data.get("ai_id")
            print(f"✅ Message sent. AI message ID: {ai_msg_id}")
            print("⏳ Prompt should now be waiting for approval...")
        
        # 3. Check for pending approvals
        print("\n3. Checking for pending approvals...")
        async with session.get(
            f"{API_BASE}/prompt-approval/pending/list",
            headers={
                "Authorization": f"Bearer {AUTH_TOKEN}"
            }
        ) as resp:
            pending = await resp.json()
            approvals = pending.get("pending_approvals", [])
            
            if approvals:
                print(f"✅ Found {len(approvals)} pending approval(s):")
                for approval in approvals:
                    print(f"   - Approval ID: {approval['approval_id']}")
                    print(f"   - Created: {approval['created_at']}")
                    
                    # Get the full prompt details
                    approval_id = approval['approval_id']
                    async with session.get(
                        f"{API_BASE}/prompt-approval/{approval_id}",
                        headers={
                            "Authorization": f"Bearer {AUTH_TOKEN}"
                        }
                    ) as detail_resp:
                        details = await detail_resp.json()
                        print(f"\n   📝 Prompt preview:")
                        for i, msg in enumerate(details['prompt']):
                            print(f"      [{msg['role']}]: {msg['content'][:100]}...")
                        
                        # Auto-approve for testing
                        print(f"\n4. Auto-approving prompt...")
                        async with session.post(
                            f"{API_BASE}/prompt-approval/{approval_id}/approve",
                            headers={
                                "Authorization": f"Bearer {AUTH_TOKEN}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "approval_id": approval_id
                            }
                        ) as approve_resp:
                            if approve_resp.status == 200:
                                print("✅ Prompt approved! Message should now be processed.")
                            else:
                                print(f"❌ Failed to approve: {await approve_resp.text()}")
            else:
                print("❌ No pending approvals found. Debug mode might not be working.")

if __name__ == "__main__":
    print("🧪 Testing Prompt Approval Debug Mode")
    print("=====================================")
    print(f"API: {API_BASE}")
    print(f"Time: {datetime.now()}")
    print()
    
    asyncio.run(test_debug_mode())