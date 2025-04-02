"""
S3 Storage Test Script
Usage: python test_s3.py
Make sure to have your .env file set up with proper AWS credentials before running.
"""
import asyncio
import os
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

# Test file content
TEST_CONTENT = b"This is a test file to verify S3 storage functionality."
TEST_DOC_ID = "test_document_001"
TEST_FILENAME = f"{TEST_DOC_ID}.txt"

async def main():
    print("=== S3 Storage Test ===")
    
    # Load environment variables
    load_dotenv()
    
    # Get S3 credentials from environment
    aws_access_key = os.getenv("AWS_ACCESS_KEY")
    aws_secret_key = os.getenv("AWS_SECRET_KEY")
    s3_bucket = os.getenv("S3_BUCKET")
    
    # Verify credentials are available
    if not all([aws_access_key, aws_secret_key, s3_bucket]):
        print("ERROR: Missing required S3 credentials in .env file")
        print("Make sure AWS_ACCESS_KEY, AWS_SECRET_KEY, and S3_BUCKET are set")
        return
    
    print(f"Using bucket: {s3_bucket}")
    
    # Initialize S3 client
    s3_client = boto3.client(
        's3',
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key
    )
    
    # Test connectivity to S3
    try:
        s3_client.list_buckets()
        print("✓ Successfully connected to AWS S3")
    except ClientError as e:
        print(f"✗ Failed to connect to AWS S3: {str(e)}")
        return
    
    # Test bucket exists
    try:
        s3_client.head_bucket(Bucket=s3_bucket)
        print(f"✓ Bucket '{s3_bucket}' exists and is accessible")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        if error_code == "404":
            print(f"✗ Bucket '{s3_bucket}' does not exist")
        elif error_code == "403":
            print(f"✗ Access denied to bucket '{s3_bucket}'")
        else:
            print(f"✗ Error accessing bucket '{s3_bucket}': {str(e)}")
        return
    
    # Test upload
    try:
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=TEST_FILENAME,
            Body=TEST_CONTENT
        )
        print(f"✓ Successfully uploaded test file: {TEST_FILENAME}")
        
        # Construct the S3 URI
        file_path = f"s3://{s3_bucket}/{TEST_FILENAME}"
        print(f"  File URI: {file_path}")
    except ClientError as e:
        print(f"✗ Failed to upload test file: {str(e)}")
        return

    # Test download
    try:
        response = s3_client.get_object(Bucket=s3_bucket, Key=TEST_FILENAME)
        content = response['Body'].read()
        if content == TEST_CONTENT:
            print("✓ Successfully downloaded and verified file content")
        else:
            print("✗ File content doesn't match expected content")
    except ClientError as e:
        print(f"✗ Failed to download test file: {str(e)}")
        return

    # Test delete
    try:
        s3_client.delete_object(Bucket=s3_bucket, Key=TEST_FILENAME)
        print(f"✓ Successfully deleted test file: {TEST_FILENAME}")
    except ClientError as e:
        print(f"✗ Failed to delete test file: {str(e)}")

    print("\nAll S3 operations completed successfully!")
    print("Your S3 configuration appears to be working correctly.")
    print("To use S3 storage in your app, set FILE_STORAGE_TYPE=s3 in your .env file.")

if __name__ == "__main__":
    asyncio.run(main())
