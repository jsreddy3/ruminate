from typing import Optional
import boto3
from botocore.exceptions import ClientError
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.interfaces.storage_repository import StorageRepository

class S3StorageRepository(StorageRepository):
    def __init__(self, bucket_name: str, aws_access_key: str = None, aws_secret_key: str = None):
        self.bucket_name = bucket_name
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
    
    async def store_file(self, file_data: bytes, document_id: str, session: Optional[AsyncSession] = None) -> str:
        """Store file in S3 and return its path"""
        key = f"{document_id}.pdf"
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_data
            )
            return f"s3://{self.bucket_name}/{key}"
        except ClientError as e:
            raise Exception(f"Failed to upload to S3: {str(e)}")
    
    async def get_file(self, file_path: str, session: Optional[AsyncSession] = None) -> Optional[bytes]:
        """Get file from S3"""
        try:
            # Extract bucket and key from s3:// URL
            _, _, bucket, key = file_path.split('/', 3)
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None
            raise Exception(f"Failed to get from S3: {str(e)}")
    
    async def delete_file(self, file_path: str, session: Optional[AsyncSession] = None) -> None:
        """Delete file from S3"""
        try:
            # Extract bucket and key from s3:// URL
            _, _, bucket, key = file_path.split('/', 3)
            self.s3_client.delete_object(Bucket=bucket, Key=key)
        except ClientError as e:
            raise Exception(f"Failed to delete from S3: {str(e)}")
