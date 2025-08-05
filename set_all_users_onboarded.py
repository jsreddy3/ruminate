#!/usr/bin/env python3
"""
Simple script to set all users as onboarded in the production database.
"""

import asyncio
import asyncpg

async def set_all_users_onboarded():
    # Production database URL
    db_url = "postgresql://postgres:Campfire123!@new-ruminate-cluster.cluster-crsosmiwisdr.us-west-1.rds.amazonaws.com:5432/postgres"
    
    try:
        # Connect to the database
        conn = await asyncpg.connect(db_url)
        print("✓ Connected to PRODUCTION database")
        
        # Count users that need updating
        count_query = """
        SELECT COUNT(*) 
        FROM users 
        WHERE has_completed_onboarding = false
        """
        users_to_update = await conn.fetchval(count_query)
        
        print(f"\nFound {users_to_update} users with onboarding not completed")
        
        if users_to_update > 0:
            # Confirm action
            print(f"\n⚠️  WARNING: This will set {users_to_update} users to onboarded status!")
            confirm = input("Type 'YES' to proceed: ").strip()
            
            if confirm == 'YES':
                # Update all users
                update_query = """
                UPDATE users 
                SET has_completed_onboarding = true,
                    updated_at = NOW()
                WHERE has_completed_onboarding = false
                RETURNING id, email, name
                """
                
                updated_users = await conn.fetch(update_query)
                
                print(f"\n✅ Successfully updated {len(updated_users)} users:")
                for user in updated_users[:10]:  # Show first 10
                    print(f"  - {user['name']} ({user['email']})")
                if len(updated_users) > 10:
                    print(f"  ... and {len(updated_users) - 10} more")
            else:
                print("Operation cancelled.")
        else:
            print("All users are already marked as onboarded!")
        
        # List current status
        print("\n" + "="*60)
        print("Current user onboarding status:")
        status_query = """
        SELECT has_completed_onboarding, COUNT(*) as count
        FROM users
        GROUP BY has_completed_onboarding
        ORDER BY has_completed_onboarding
        """
        status_results = await conn.fetch(status_query)
        
        for row in status_results:
            status = "Onboarded" if row['has_completed_onboarding'] else "Not onboarded"
            print(f"  {status}: {row['count']} users")
        
        # Close the connection
        await conn.close()
        print("\nDatabase connection closed")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(set_all_users_onboarded())