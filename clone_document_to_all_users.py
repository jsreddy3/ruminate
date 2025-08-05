import asyncio
import asyncpg
from datetime import datetime

async def clone_document_to_all_users():
    # Database connection
    db_url = "postgresql://postgres:Campfire123!@new-ruminate-cluster.cluster-crsosmiwisdr.us-west-1.rds.amazonaws.com:5432/postgres"
    
    # Document to clone
    source_document_id = "515cebf1-09ed-46f0-a249-4019fcd1cdba"
    
    try:
        # Connect to the database
        conn = await asyncpg.connect(db_url)
        print("Connected to database successfully")
        
        # First, verify the source document exists
        doc_check = await conn.fetchval(
            "SELECT COUNT(*) FROM documents WHERE id = $1",
            source_document_id
        )
        
        if doc_check == 0:
            print(f"Error: Source document {source_document_id} not found!")
            await conn.close()
            return
        
        # Get document info
        doc_info = await conn.fetchrow(
            "SELECT title, user_id FROM documents WHERE id = $1",
            source_document_id
        )
        print(f"Source document: {doc_info['title']} (owned by user: {doc_info['user_id']})")
        
        # Get all users
        users = await conn.fetch("SELECT id, email, name FROM users ORDER BY created_at")
        print(f"\nFound {len(users)} users")
        
        # Track results
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for user in users:
            user_id = user['id']
            user_email = user['email']
            user_name = user['name']
            
            # Skip if user already owns the original document
            if user_id == doc_info['user_id']:
                print(f"  - Skipping {user_name} ({user_email}) - owns the original document")
                skip_count += 1
                continue
            
            # Check if user already has a clone of this document
            existing_clone = await conn.fetchval("""
                SELECT COUNT(*) 
                FROM documents 
                WHERE user_id = $1 
                AND (
                    id = $2 
                    OR title LIKE '%' || (SELECT title FROM documents WHERE id = $2) || '%'
                )
            """, user_id, source_document_id)
            
            if existing_clone > 0:
                print(f"  - Skipping {user_name} ({user_email}) - already has this document")
                skip_count += 1
                continue
            
            try:
                # Clone the document using the PostgreSQL function
                new_doc_id = await conn.fetchval(
                    "SELECT clone_document_with_everything($1, $2)",
                    source_document_id,
                    user_id
                )
                
                if new_doc_id:
                    print(f"  ✓ Cloned to {user_name} ({user_email}) - new doc ID: {new_doc_id}")
                    success_count += 1
                else:
                    print(f"  ✗ Failed to clone for {user_name} ({user_email}) - function returned NULL")
                    error_count += 1
                    
            except Exception as e:
                print(f"  ✗ Error cloning for {user_name} ({user_email}): {str(e)}")
                error_count += 1
        
        # Summary
        print(f"\n{'='*60}")
        print(f"SUMMARY:")
        print(f"  Total users: {len(users)}")
        print(f"  Successfully cloned: {success_count}")
        print(f"  Skipped: {skip_count}")
        print(f"  Errors: {error_count}")
        print(f"{'='*60}")
        
        # Close the connection
        await conn.close()
        print("\nDatabase connection closed")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(clone_document_to_all_users())