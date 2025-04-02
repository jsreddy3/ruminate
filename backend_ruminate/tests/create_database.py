"""
Create PostgreSQL Database Script
Usage: python create_database.py
"""
import asyncio
import os
from dotenv import load_dotenv
import asyncpg

async def create_database():
    # Load environment variables
    load_dotenv()
    
    # Get RDS credentials from environment
    db_user = os.getenv("RDS_MASTER_USERNAME")
    db_password = os.getenv("RDS_MASTER_PASSWORD")
    db_host = os.getenv("RDS_DB_HOST")
    db_port = os.getenv("RDS_DB_PORT", "5432")
    db_name = os.getenv("RDS_DB_NAME")
    
    if not all([db_user, db_password, db_host, db_name]):
        print("ERROR: Missing required RDS credentials in .env file")
        return
    
    print(f"Connecting to default PostgreSQL database at {db_host}")
    
    try:
        # Connect to the default 'postgres' database
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database='postgres'  # This is the default database that exists in every PostgreSQL instance
        )
        
        # Check if our target database already exists
        db_exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            db_name
        )
        
        if db_exists:
            print(f"Database '{db_name}' already exists")
        else:
            # Create a new database - we need to use execute instead of SQL parameters here
            # because database names cannot be parameterized in PostgreSQL
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"Database '{db_name}' created successfully")
        
        await conn.close()
        print("\nYou can now run your application, which will create all the tables!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        print("\nPossible issues:")
        print("1. Incorrect credentials")
        print("2. Network connectivity issues")
        print("3. Insufficient permissions to create a database")

async def main():
    print("=== PostgreSQL Database Creation ===")
    await create_database()

if __name__ == "__main__":
    asyncio.run(main())
