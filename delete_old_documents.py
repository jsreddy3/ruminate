import asyncio
import asyncpg
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

async def delete_old_documents():
    # Load environment variables
    load_dotenv()
    
    # Database connection string
    db_url = "postgresql://postgres:Campfire123!@new-ruminate-cluster.cluster-crsosmiwisdr.us-west-1.rds.amazonaws.com:5432/postgres"
    
    try:
        # Connect to the database
        conn = await asyncpg.connect(db_url)
        print("Connected to database successfully")
        
        # Calculate the cutoff time (24 hours ago)
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        print(f"Deleting documents created before: {cutoff_time}")
        
        # First, let's check how many documents will be deleted
        count_query = """
        SELECT COUNT(*) 
        FROM documents 
        WHERE created_at < $1
        """
        count = await conn.fetchval(count_query, cutoff_time)
        print(f"Found {count} documents older than 24 hours")
        
        if count > 0:
            # Get document IDs to delete
            get_ids_query = """
            SELECT id, title, created_at 
            FROM documents 
            WHERE created_at < $1
            """
            documents_to_delete = await conn.fetch(get_ids_query, cutoff_time)
            
            # Delete in proper order to respect foreign key constraints
            print("\nDeleting related data...")
            
            # Start a transaction
            async with conn.transaction():
                # First, update messages to remove parent references
                await conn.execute("""
                    UPDATE messages 
                    SET parent_id = NULL 
                    WHERE parent_id IN (
                        SELECT id FROM messages 
                        WHERE document_id IN (
                            SELECT id FROM documents WHERE created_at < $1
                        )
                    )
                """, cutoff_time)
                
                # Delete messages that belong to documents being deleted
                messages_deleted = await conn.execute("""
                    DELETE FROM messages 
                    WHERE document_id IN (
                        SELECT id FROM documents WHERE created_at < $1
                    )
                """, cutoff_time)
                print(f"  - Deleted messages (by document): {messages_deleted.split()[-1]}")
                
                # Delete messages that belong to conversations of documents being deleted
                messages_conv_deleted = await conn.execute("""
                    DELETE FROM messages 
                    WHERE conversation_id IN (
                        SELECT id FROM conversations 
                        WHERE document_id IN (
                            SELECT id FROM documents WHERE created_at < $1
                        )
                    )
                """, cutoff_time)
                print(f"  - Deleted messages (by conversation): {messages_conv_deleted.split()[-1]}")
                
                # Now delete conversations
                conversations_deleted = await conn.execute("""
                    DELETE FROM conversations 
                    WHERE document_id IN (
                        SELECT id FROM documents WHERE created_at < $1
                    )
                """, cutoff_time)
                print(f"  - Deleted conversations: {conversations_deleted.split()[-1]}")
                
                # Delete blocks
                blocks_deleted = await conn.execute("""
                    DELETE FROM blocks 
                    WHERE document_id IN (
                        SELECT id FROM documents WHERE created_at < $1
                    )
                """, cutoff_time)
                print(f"  - Deleted blocks: {blocks_deleted.split()[-1]}")
                
                # Delete chunks
                chunks_deleted = await conn.execute("""
                    DELETE FROM chunks 
                    WHERE document_id IN (
                        SELECT id FROM documents WHERE created_at < $1
                    )
                """, cutoff_time)
                print(f"  - Deleted chunks: {chunks_deleted.split()[-1]}")
                
                # Delete pages
                pages_deleted = await conn.execute("""
                    DELETE FROM pages 
                    WHERE document_id IN (
                        SELECT id FROM documents WHERE created_at < $1
                    )
                """, cutoff_time)
                print(f"  - Deleted pages: {pages_deleted.split()[-1]}")
                
                # Finally delete documents
                delete_query = """
                DELETE FROM documents 
                WHERE created_at < $1
                """
                documents_deleted = await conn.execute(delete_query, cutoff_time)
                print(f"  - Deleted documents: {documents_deleted.split()[-1]}")
            
            print(f"\nDeleted {len(documents_to_delete)} documents:")
            for record in documents_to_delete[:10]:  # Show first 10
                print(f"  - {record['id']}: {record['title']} (created: {record['created_at']})")
            if len(documents_to_delete) > 10:
                print(f"  ... and {len(documents_to_delete) - 10} more")
        else:
            print("No documents to delete")
        
        # Close the connection
        await conn.close()
        print("\nDatabase connection closed")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(delete_old_documents())