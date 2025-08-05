#!/usr/bin/env python3
"""
Emergency script to set all production users to onboarded status.
"""

import asyncio
import asyncpg
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def fix_all_onboarding():
    # Production database connection
    conn = await asyncpg.connect(
        host='new-ruminate-cluster.cluster-crsosmiwisdr.us-west-1.rds.amazonaws.com',
        port=5432,
        user='postgres',
        password='Campfire123!',
        database='postgres'
    )
    
    try:
        # Update all users to onboarded
        result = await conn.execute('''
            UPDATE users 
            SET has_completed_onboarding = true
            WHERE has_completed_onboarding = false OR has_completed_onboarding IS NULL
        ''')
        
        # Get the count from the result
        count = int(result.split()[-1])
        
        print(f"✅ SUCCESS: Updated {count} users to onboarded status in PRODUCTION")
        
        # Show current status
        total_users = await conn.fetchval('SELECT COUNT(*) FROM users')
        onboarded_users = await conn.fetchval('SELECT COUNT(*) FROM users WHERE has_completed_onboarding = true')
        
        print(f"\nCurrent status:")
        print(f"Total users: {total_users}")
        print(f"Onboarded users: {onboarded_users}")
        print(f"Percentage onboarded: {(onboarded_users/total_users*100):.1f}%")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    print("🚨 EMERGENCY FIX: Setting all production users to onboarded...")
    asyncio.run(fix_all_onboarding())