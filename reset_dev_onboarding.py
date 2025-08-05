#!/usr/bin/env python3
"""
Script to reset all dev/local users to NOT onboarded for debugging.
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def reset_dev_onboarding():
    # Get local database credentials from env
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'postgres')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'ruminate')
    
    print(f"Connecting to local database at {db_host}:{db_port}/{db_name}...")
    
    conn = await asyncpg.connect(
        host=db_host,
        port=int(db_port),
        user=db_user,
        password=db_password,
        database=db_name
    )
    
    try:
        # Update all users to NOT onboarded
        result = await conn.execute('''
            UPDATE users 
            SET has_completed_onboarding = false
            WHERE has_completed_onboarding = true OR has_completed_onboarding IS NULL
        ''')
        
        # Get the count from the result
        count = int(result.split()[-1])
        
        print(f"✅ SUCCESS: Reset {count} users to NOT onboarded in DEV/LOCAL")
        
        # Show current status
        total_users = await conn.fetchval('SELECT COUNT(*) FROM users')
        not_onboarded_users = await conn.fetchval('SELECT COUNT(*) FROM users WHERE has_completed_onboarding = false')
        
        print(f"\nCurrent status:")
        print(f"Total users: {total_users}")
        print(f"Not onboarded users: {not_onboarded_users}")
        print(f"Percentage NOT onboarded: {(not_onboarded_users/total_users*100 if total_users > 0 else 0):.1f}%")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    print("🔧 DEV/LOCAL: Resetting all users to NOT onboarded for debugging...")
    asyncio.run(reset_dev_onboarding())