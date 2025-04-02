"""
RDS Connection Test Script with improved debugging
Usage: python test_rds_debug.py
"""
import asyncio
import os
import sys
from dotenv import load_dotenv
import socket
import asyncpg
from asyncio import TimeoutError

# Set a short timeout for connection attempts
CONNECTION_TIMEOUT = 5  # seconds

async def test_connection_with_timeout():
    # Load environment variables
    load_dotenv()
    
    # Get RDS credentials from environment
    db_user = os.getenv("RDS_MASTER_USERNAME")
    db_password = os.getenv("RDS_MASTER_PASSWORD")
    db_host = os.getenv("RDS_DB_HOST")
    db_port = os.getenv("RDS_DB_PORT", "5432")
    db_name = os.getenv("RDS_DB_NAME")
    
    # Verify credentials are available
    if not all([db_user, db_password, db_host, db_name]):
        print("ERROR: Missing required RDS credentials in .env file")
        print("Make sure RDS_MASTER_USERNAME, RDS_MASTER_PASSWORD, RDS_DB_HOST, and RDS_DB_NAME are set")
        return
    
    print(f"Connecting to: PostgreSQL database '{db_name}' at {db_host}:{db_port}")
    print(f"Using username: {db_user}")
    
    # First, test basic network connectivity with socket
    print(f"\nTesting TCP connectivity to {db_host}:{db_port}...")
    try:
        # Create socket and set timeout
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(CONNECTION_TIMEOUT)
        
        # Attempt to connect
        result = sock.connect_ex((db_host, int(db_port)))
        
        if result == 0:
            print(f"✓ TCP connection to {db_host}:{db_port} successful")
        else:
            print(f"✗ TCP connection to {db_host}:{db_port} failed with error code: {result}")
            print("\nPossible issues:")
            print("1. RDS instance's security group doesn't allow connections from your IP")
            print("2. Network connectivity issues")
            print("3. RDS instance is not running")
            print("\nAction required: Check your RDS security group settings in AWS console")
            print("Add a rule to allow incoming connections from your IP address on port 5432")
            return
    except socket.timeout:
        print(f"✗ TCP connection to {db_host}:{db_port} timed out after {CONNECTION_TIMEOUT} seconds")
        print("This suggests a network connectivity issue or security group restriction")
        return
    except Exception as e:
        print(f"✗ Error testing TCP connection: {str(e)}")
        return
    finally:
        sock.close()
    
    # Now try PostgreSQL connection
    print("\nTesting PostgreSQL connection...")
    try:
        # Build connection string
        conn_str = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        
        # Attempt connection with timeout
        conn = await asyncio.wait_for(
            asyncpg.connect(conn_str), 
            timeout=CONNECTION_TIMEOUT
        )
        
        # Test query
        result = await conn.fetchval("SELECT 1")
        print(f"✓ PostgreSQL connection successful! Test query result: {result}")
        await conn.close()
        
        print("\nYour RDS connection is working correctly!")
        print("You can now implement your RDS repositories.")
        
    except TimeoutError:
        print(f"✗ PostgreSQL connection timed out after {CONNECTION_TIMEOUT} seconds")
        print("This suggests a network connectivity issue, security group restriction, or incorrect credentials")
    except asyncpg.exceptions.InvalidPasswordError:
        print("✗ Authentication failed: Incorrect username or password")
    except asyncpg.exceptions.InvalidCatalogNameError:
        print(f"✗ Database '{db_name}' does not exist")
        print("You may need to create the database first")
    except Exception as e:
        print(f"✗ PostgreSQL connection error: {str(e)}")
        print(f"Error type: {type(e).__name__}")

async def main():
    print("=== RDS PostgreSQL Connection Test (with Timeout) ===")
    try:
        await test_connection_with_timeout()
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
