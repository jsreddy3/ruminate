"""
Reset and initialize the local SQLite database with the correct schema.
This script will completely reset the database and create all required tables.
"""
import os
import asyncio
import sqlite3
from src.repositories.implementations.sqlite_document_repository import SQLiteDocumentRepository
from src.repositories.implementations.sqlite_conversation_repository import SQLiteConversationRepository

# Database path from environment
DATA_DIR = "local_db"
DB_PATH = os.path.join(DATA_DIR, "sqlite.db")

def reset_database():
    """Reset the database by removing and recreating it."""
    print(f"Resetting database at {DB_PATH}...")
    
    # Create data directory if it doesn't exist
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Remove existing database file if it exists
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Removed existing database file: {DB_PATH}")
    
    # Initialize document repository (this will create tables)
    doc_repo = SQLiteDocumentRepository(DB_PATH)
    print("Document repository tables created")
    
    # Initialize conversation repository (this will create conversation tables)
    convo_repo = SQLiteConversationRepository(DB_PATH)
    print("Conversation repository tables created")
    
    # Verify tables were created
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print("\nTables in database:")
        for table in tables:
            print(f"- {table[0]}")
            
            # Show schema for each table
            cursor.execute(f"PRAGMA table_info({table[0]})")
            columns = cursor.fetchall()
            for col in columns:
                print(f"  - {col[1]} ({col[2]})")
    
    print("\nDatabase reset complete!")

if __name__ == "__main__":
    reset_database()
