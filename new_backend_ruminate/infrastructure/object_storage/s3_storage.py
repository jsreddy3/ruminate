"""AWS S3 implementation of ObjectStorageInterface"""
import aioboto3
import boto3
from typing import BinaryIO, Optional
from botocore.exceptions import ClientError
from new_backend_ruminate.domain.object_storage.storage_interface import ObjectStorageInterface


class S3ObjectStorage(ObjectStorageInterface):
    """AWS S3 storage implementation"""
    
    def __init__(self, bucket_name: str, region: str = 'us-east-1', 
                 aws_access_key_id: Optional[str] = None,
                 aws_secret_access_key: Optional[str] = None):
        self.bucket_name = bucket_name
        self.region = region
        self.aws_access_key_id = aws_access_key_id
        self.aws_secret_access_key = aws_secret_access_key
        self.session = aioboto3.Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region
        )
        # Sync client for presigned URLs (doesn't make network calls)
        self._sync_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region
        )
    
    async def upload_file(self, file: BinaryIO, key: str, content_type: Optional[str] = None) -> str:
        """Upload a file to S3"""
        # Read file content
        file.seek(0)
        content = file.read()
        
        async with self.session.client('s3') as s3:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            await s3.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=content,
                **extra_args
            )
        
        return f"s3://{self.bucket_name}/{key}"
    
    async def download_file(self, key: str) -> bytes:
        """Download a file from S3"""
        async with self.session.client('s3') as s3:
            try:
                response = await s3.get_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
                content = await response['Body'].read()
                return content
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchKey':
                    raise FileNotFoundError(f"File not found: {key}")
                raise
    
    async def delete_file(self, key: str) -> bool:
        """Delete a file from S3"""
        async with self.session.client('s3') as s3:
            try:
                await s3.delete_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
                return True
            except ClientError:
                return False
    
    async def file_exists(self, key: str) -> bool:
        """Check if a file exists in S3"""
        async with self.session.client('s3') as s3:
            try:
                await s3.head_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
                return True
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    return False
                raise
    
    async def get_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """Generate a presigned URL for temporary access"""
        # Use sync client for presigned URLs - it's a local operation
        url = self._sync_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': self.bucket_name,
                'Key': key
            },
            ExpiresIn=expiration
        )
        return url
    
    async def generate_presigned_post(self, key: str, content_type: Optional[str] = None, expires_in: int = 3600) -> dict:
        """Generate a presigned POST URL and fields for direct upload"""
        # Build conditions for the POST policy
        conditions = [
            {'bucket': self.bucket_name},
            {'key': key}
        ]
        
        fields = {'key': key}
        
        if content_type:
            conditions.append({'Content-Type': content_type})
            fields['Content-Type'] = content_type
        
        # Use sync client for presigned POST - it's a local operation
        response = self._sync_client.generate_presigned_post(
            Bucket=self.bucket_name,
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=expires_in
        )
        
        return response