#!/usr/bin/env python3
"""
Script to manage user onboarding status in the database.
"""

import asyncio
import asyncpg

async def manage_onboarding():
    # Database URLs
    local_db_url = "postgresql://postgres:postgres@localhost:5432/ruminate"
    prod_db_url = "postgresql://postgres:Campfire123!@new-ruminate-cluster.cluster-crsosmiwisdr.us-west-1.rds.amazonaws.com:5432/postgres"
    
    print("🔧 Onboarding Status Manager")
    print("=" * 60)
    
    # Select environment
    print("\nSelect environment:")
    print("1. Local database")
    print("2. Production database (⚠️  CAUTION)")
    
    env_choice = input("\nEnter choice (1 or 2): ").strip()
    if env_choice == '1':
        db_url = local_db_url
        env_name = "LOCAL"
    elif env_choice == '2':
        db_url = prod_db_url
        env_name = "PRODUCTION"
        print("\n⚠️  WARNING: You are about to modify the PRODUCTION database!")
        confirm = input("Type 'CONFIRM' to proceed: ").strip()
        if confirm != 'CONFIRM':
            print("Operation cancelled.")
            return
    else:
        print("Invalid choice.")
        return
    
    try:
        # Connect to the database
        conn = await asyncpg.connect(db_url)
        print(f"\n✓ Connected to {env_name} database")
        
        while True:
            print("\n" + "=" * 60)
            print("Options:")
            print("1. Set specific user(s) to ONBOARDED")
            print("2. Set specific user(s) to NOT ONBOARDED")
            print("3. Set ALL users to ONBOARDED")
            print("4. Set ALL users to NOT ONBOARDED")
            print("5. List all users and their status")
            print("6. Show summary statistics")
            print("7. Exit")
            
            choice = input("\nEnter choice (1-7): ").strip()
            
            if choice in ['1', '2']:
                # Set specific users
                onboarded = (choice == '1')
                status_text = "ONBOARDED" if onboarded else "NOT ONBOARDED"
                
                print(f"\nSet users to {status_text}")
                print("Enter user emails or IDs (comma-separated, or 'cancel' to go back):")
                user_input = input("> ").strip()
                
                if user_input.lower() == 'cancel':
                    continue
                
                # Parse input
                user_identifiers = [u.strip() for u in user_input.split(',') if u.strip()]
                
                if not user_identifiers:
                    print("No users specified.")
                    continue
                
                # Find users by email or ID
                updated_count = 0
                not_found = []
                
                for identifier in user_identifiers:
                    # Check if it's an email or ID
                    if '@' in identifier:
                        query = """
                        UPDATE users 
                        SET has_completed_onboarding = $1, updated_at = NOW()
                        WHERE email = $2
                        RETURNING id, email, name
                        """
                        result = await conn.fetch(query, onboarded, identifier)
                    else:
                        query = """
                        UPDATE users 
                        SET has_completed_onboarding = $1, updated_at = NOW()
                        WHERE id = $2
                        RETURNING id, email, name
                        """
                        result = await conn.fetch(query, onboarded, identifier)
                    
                    if result:
                        user = result[0]
                        print(f"  ✓ Updated {user['name']} ({user['email']}) to {status_text}")
                        updated_count += 1
                    else:
                        not_found.append(identifier)
                
                print(f"\nSummary: Updated {updated_count} user(s)")
                if not_found:
                    print(f"Not found: {', '.join(not_found)}")
            
            elif choice in ['3', '4']:
                # Set ALL users
                onboarded = (choice == '3')
                status_text = "ONBOARDED" if onboarded else "NOT ONBOARDED"
                
                # Count users that will be affected
                count_query = """
                SELECT COUNT(*) FROM users WHERE has_completed_onboarding != $1
                """
                affected_count = await conn.fetchval(count_query, onboarded)
                
                if affected_count == 0:
                    print(f"\nAll users are already {status_text}!")
                    continue
                
                print(f"\n⚠️  WARNING: This will set {affected_count} users to {status_text}!")
                
                if env_name == "PRODUCTION":
                    confirm1 = input("Type 'I UNDERSTAND' to continue: ").strip()
                    if confirm1 != 'I UNDERSTAND':
                        print("Operation cancelled.")
                        continue
                
                confirm2 = input(f"Are you sure? Type 'YES' to confirm: ").strip()
                if confirm2 != 'YES':
                    print("Operation cancelled.")
                    continue
                
                # Update all users
                update_query = """
                UPDATE users 
                SET has_completed_onboarding = $1, updated_at = NOW()
                WHERE has_completed_onboarding != $1
                RETURNING id, email, name
                """
                updated_users = await conn.fetch(update_query, onboarded)
                
                print(f"\n✅ Successfully updated {len(updated_users)} users to {status_text}")
                for user in updated_users[:5]:  # Show first 5
                    print(f"  - {user['name']} ({user['email']})")
                if len(updated_users) > 5:
                    print(f"  ... and {len(updated_users) - 5} more")
            
            elif choice == '5':
                # List all users
                query = """
                SELECT id, email, name, has_completed_onboarding, created_at
                FROM users
                ORDER BY created_at DESC
                """
                users = await conn.fetch(query)
                
                print(f"\nAll users ({len(users)} total):")
                print("-" * 100)
                print(f"{'Email':<35} {'Name':<25} {'Status':<15} {'User ID'}")
                print("-" * 100)
                
                for user in users:
                    status = "✓ Onboarded" if user['has_completed_onboarding'] else "✗ Not onboarded"
                    print(f"{user['email']:<35} {user['name']:<25} {status:<15} {user['id']}")
            
            elif choice == '6':
                # Show statistics
                stats_query = """
                SELECT 
                    has_completed_onboarding,
                    COUNT(*) as count
                FROM users
                GROUP BY has_completed_onboarding
                ORDER BY has_completed_onboarding
                """
                stats = await conn.fetch(stats_query)
                
                total_users = sum(row['count'] for row in stats)
                
                print(f"\nOnboarding Statistics ({env_name}):")
                print("-" * 40)
                
                for row in stats:
                    status = "Onboarded" if row['has_completed_onboarding'] else "Not onboarded"
                    percentage = (row['count'] / total_users * 100) if total_users > 0 else 0
                    print(f"{status:<15}: {row['count']:>3} users ({percentage:>5.1f}%)")
                
                print("-" * 40)
                print(f"{'Total':<15}: {total_users:>3} users")
            
            elif choice == '7':
                print("\nExiting...")
                break
            
            else:
                print("Invalid choice. Please try again.")
        
        # Close the connection
        await conn.close()
        
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    asyncio.run(manage_onboarding())