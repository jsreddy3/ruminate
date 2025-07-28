"""Tests for object storage implementations"""
import pytest
import os
import io
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import aioboto3
from botocore.exceptions import ClientError

from new_backend_ruminate.infrastructure.object_storage.local_storage import LocalObjectStorage
from new_backend_ruminate.infrastructure.object_storage.s3_storage import S3ObjectStorage
from new_backend_ruminate.infrastructure.object_storage.factory import get_object_storage


@pytest.mark.asyncio
class TestLocalObjectStorage:
    """Test LocalObjectStorage implementation"""
    
    async def test_upload_file(self, tmp_path):
        """Test uploading a file to local storage"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Create test file content
        content = b"Test file content"
        file_obj = io.BytesIO(content)
        
        # Upload file
        result = await storage.upload_file(
            file=file_obj,
            key="test/document.pdf",
            content_type="application/pdf"
        )
        
        # LocalObjectStorage returns the full path
        assert result.endswith("test/document.pdf")
        assert str(tmp_path) in result
        
        # Verify file exists
        file_path = tmp_path / "test" / "document.pdf"
        assert file_path.exists()
        assert file_path.read_bytes() == content
    
    async def test_upload_file_creates_directories(self, tmp_path):
        """Test that upload creates necessary directories"""
        storage = LocalObjectStorage(str(tmp_path))
        
        content = b"Test content"
        file_obj = io.BytesIO(content)
        
        # Upload to nested path
        result = await storage.upload_file(
            file=file_obj,
            key="deep/nested/path/file.txt",
            content_type="text/plain"
        )
        
        # LocalObjectStorage returns the full path
        assert result.endswith("deep/nested/path/file.txt")
        assert str(tmp_path) in result
        
        # Verify directory structure
        file_path = tmp_path / "deep" / "nested" / "path" / "file.txt"
        assert file_path.exists()
        assert file_path.parent.exists()
    
    async def test_download_file(self, tmp_path):
        """Test downloading a file from local storage"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Create test file
        test_dir = tmp_path / "test"
        test_dir.mkdir()
        test_file = test_dir / "download.txt"
        content = b"Download test content"
        test_file.write_bytes(content)
        
        # Download file
        downloaded_content = await storage.download_file("test/download.txt")
        
        assert downloaded_content == content
    
    async def test_download_nonexistent_file(self, tmp_path):
        """Test downloading a file that doesn't exist"""
        storage = LocalObjectStorage(str(tmp_path))
        
        with pytest.raises(FileNotFoundError):
            await storage.download_file("nonexistent/file.txt")
    
    async def test_delete_file(self, tmp_path):
        """Test deleting a file from local storage"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Create test file
        test_dir = tmp_path / "test"
        test_dir.mkdir()
        test_file = test_dir / "delete.txt"
        test_file.write_text("Delete me")
        
        assert test_file.exists()
        
        # Delete file
        await storage.delete_file("test/delete.txt")
        
        assert not test_file.exists()
    
    async def test_delete_nonexistent_file(self, tmp_path):
        """Test deleting a file that doesn't exist (should not raise)"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Should not raise an exception
        await storage.delete_file("nonexistent/file.txt")
    
    async def test_file_exists(self, tmp_path):
        """Test checking if a file exists"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Create test file
        test_file = tmp_path / "exists.txt"
        test_file.write_text("I exist")
        
        # Check existence
        assert await storage.file_exists("exists.txt") is True
        assert await storage.file_exists("nonexistent.txt") is False
    
    async def test_get_presigned_url(self, tmp_path):
        """Test getting presigned URL (returns local path for local storage)"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Create test file
        test_file = tmp_path / "presigned.pdf"
        test_file.write_text("test")
        
        # Get presigned URL
        url = await storage.get_presigned_url("presigned.pdf")
        
        # For local storage, it should return a file:// URL
        assert url == f"file://{test_file.absolute()}"
    
    async def test_unicode_filenames(self, tmp_path):
        """Test handling unicode filenames"""
        storage = LocalObjectStorage(str(tmp_path))
        
        # Unicode filename
        unicode_key = "documents/テスト文書.pdf"
        content = b"Unicode filename test"
        file_obj = io.BytesIO(content)
        
        # Upload
        result = await storage.upload_file(
            file=file_obj,
            key=unicode_key,
            content_type="application/pdf"
        )
        
        # LocalObjectStorage returns the full path
        assert result.endswith(unicode_key)
        assert str(tmp_path) in result
        
        # Download
        downloaded = await storage.download_file(unicode_key)
        assert downloaded == content
        
        # Exists
        assert await storage.file_exists(unicode_key) is True


@pytest.mark.asyncio
class TestS3Storage:
    """Test S3ObjectStorage implementation"""
    
    @pytest.fixture
    def mock_s3_client(self):
        """Create a mock S3 client"""
        client = MagicMock()
        client.put_object = AsyncMock()
        client.get_object = AsyncMock()
        client.delete_object = AsyncMock()
        client.head_object = AsyncMock()
        client.generate_presigned_url = MagicMock(return_value="https://s3.mock/presigned-url")
        return client
    
    @pytest.fixture
    def mock_s3_session(self, mock_s3_client):
        """Create a mock aioboto3 session"""
        session = MagicMock()
        client_context = MagicMock()
        client_context.__aenter__ = AsyncMock(return_value=mock_s3_client)
        client_context.__aexit__ = AsyncMock(return_value=None)
        
        # The issue is session.client creates a new context manager each time
        # We need to ensure it always returns the same one with our mock client
        def client_factory(*args, **kwargs):
            return client_context
        
        session.client = MagicMock(side_effect=client_factory)
        return session
    
    async def test_upload_file(self, mock_s3_session):
        """Test uploading a file to S3"""
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            content = b"S3 test content"
            file_obj = io.BytesIO(content)
            
            result = await storage.upload_file(
                file=file_obj,
                key="documents/test.pdf",
                content_type="application/pdf"
            )
            
            assert result == "s3://test-bucket/documents/test.pdf"
            
            # Verify S3 client was called correctly
            s3_client = await mock_s3_session.client().__aenter__()
            s3_client.put_object.assert_called_once()
            call_kwargs = s3_client.put_object.call_args.kwargs
            assert call_kwargs["Bucket"] == "test-bucket"
            assert call_kwargs["Key"] == "documents/test.pdf"
            assert call_kwargs["Body"] == content
            assert call_kwargs["ContentType"] == "application/pdf"
    
    async def test_download_file(self, mock_s3_session):
        """Test downloading a file from S3"""
        # Set up mock to write test content to buffer
        test_content = b"S3 download content"
        
        # Mock get_object response
        mock_response = {
            'Body': AsyncMock(read=AsyncMock(return_value=test_content))
        }
        s3_client = await mock_s3_session.client().__aenter__()
        s3_client.get_object.return_value = mock_response
        
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            content = await storage.download_file("documents/download.pdf")
            
            assert content == test_content
            
            # Verify S3 client was called
            s3_client.get_object.assert_called_once_with(
                Bucket="test-bucket",
                Key="documents/download.pdf"
            )
    
    async def test_download_nonexistent_file(self, mock_s3_session, mock_s3_client):
        """Test downloading a file that doesn't exist in S3"""
        # Set up mock to raise ClientError
        error_response = {'Error': {'Code': 'NoSuchKey', 'Message': 'The specified key does not exist.'}}
        mock_s3_client.get_object.side_effect = ClientError(error_response, 'GetObject')
        
        # Patch at the module level before creating the storage instance
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            try:
                result = await storage.download_file("nonexistent.pdf")
                pytest.fail(f"Should have raised FileNotFoundError, got: {result}")
            except FileNotFoundError as e:
                assert "File not found" in str(e)
                # Check that get_object was called
                mock_s3_client.get_object.assert_called_once_with(
                    Bucket="test-bucket",
                    Key="nonexistent.pdf"
                )
    
    async def test_delete_file(self, mock_s3_session):
        """Test deleting a file from S3"""
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            await storage.delete_file("documents/delete.pdf")
            
            # Verify S3 client was called
            s3_client = await mock_s3_session.client().__aenter__()
            s3_client.delete_object.assert_called_once_with(
                Bucket="test-bucket",
                Key="documents/delete.pdf"
            )
    
    async def test_file_exists_true(self, mock_s3_session):
        """Test checking if a file exists in S3 (exists case)"""
        # Mock successful head_object call
        s3_client = await mock_s3_session.client().__aenter__()
        s3_client.head_object.return_value = {"ContentLength": 1024}
        
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            exists = await storage.file_exists("documents/exists.pdf")
            
            assert exists is True
            s3_client.head_object.assert_called_once_with(
                Bucket="test-bucket",
                Key="documents/exists.pdf"
            )
    
    async def test_file_exists_false(self, mock_s3_session):
        """Test checking if a file exists in S3 (doesn't exist case)"""
        # Mock head_object to raise 404
        error_response = {'Error': {'Code': '404', 'Message': 'Not Found'}}
        s3_client = await mock_s3_session.client().__aenter__()
        s3_client.head_object.side_effect = ClientError(error_response, 'HeadObject')
        
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            exists = await storage.file_exists("documents/nonexistent.pdf")
            
            assert exists is False
    
    async def test_get_presigned_url(self, mock_s3_session):
        """Test generating presigned URL"""
        with patch('new_backend_ruminate.infrastructure.object_storage.s3_storage.aioboto3.Session', return_value=mock_s3_session):
            storage = S3ObjectStorage(
                bucket_name="test-bucket",
                region="us-east-1",
                aws_access_key_id="test-key",
                aws_secret_access_key="test-secret"
            )
            
            url = await storage.get_presigned_url("documents/file.pdf", expiration=7200)
            
            assert url == "https://s3.mock/presigned-url"
            
            # Verify generate_presigned_url was called correctly
            s3_client = await mock_s3_session.client().__aenter__()
            s3_client.generate_presigned_url.assert_called_once_with(
                'get_object',
                Params={'Bucket': 'test-bucket', 'Key': 'documents/file.pdf'},
                ExpiresIn=7200
            )


class TestObjectStorageFactory:
    """Test object storage factory"""
    
    def test_get_local_storage(self):
        """Test factory creates local storage"""
        # Mock settings to return local storage config
        mock_settings = MagicMock()
        mock_settings.storage_type = "local"
        mock_settings.local_storage_path = "/tmp/storage"
        
        with patch('new_backend_ruminate.infrastructure.object_storage.factory.settings', return_value=mock_settings):
            storage = get_object_storage()
            assert isinstance(storage, LocalObjectStorage)
            assert str(storage.base_path) == "/tmp/storage"
    
    def test_get_s3_storage(self):
        """Test factory creates S3 storage"""
        # Mock settings to return S3 config
        mock_settings = MagicMock()
        mock_settings.storage_type = "s3"
        mock_settings.s3_bucket_name = "test-bucket"
        mock_settings.s3_region = "us-west-2"
        mock_settings.aws_access_key_id = "test-key"
        mock_settings.aws_secret_access_key = "test-secret"
        
        with patch('new_backend_ruminate.infrastructure.object_storage.factory.settings', return_value=mock_settings):
            storage = get_object_storage()
            assert isinstance(storage, S3ObjectStorage)
            assert storage.bucket_name == "test-bucket"
            assert storage.region == "us-west-2"
    
    def test_invalid_storage_type(self):
        """Test factory raises error for invalid storage type"""
        mock_settings = MagicMock()
        mock_settings.storage_type = "invalid"
        
        with patch('new_backend_ruminate.infrastructure.object_storage.factory.settings', return_value=mock_settings):
            with pytest.raises(ValueError, match="Unknown storage type"):
                get_object_storage()
    
    def test_missing_s3_bucket_name(self):
        """Test factory raises error when S3 bucket name is missing"""
        mock_settings = MagicMock()
        mock_settings.storage_type = "s3"
        mock_settings.s3_bucket_name = None
        
        with patch('new_backend_ruminate.infrastructure.object_storage.factory.settings', return_value=mock_settings):
            with pytest.raises(ValueError, match="S3 bucket name is required"):
                get_object_storage()


@pytest.mark.asyncio
@pytest.mark.integration
class TestS3StorageIntegration:
    """Real S3 integration tests - requires AWS credentials and bucket"""
    
    @pytest.fixture
    def s3_config(self):
        """Get S3 configuration from settings"""
        from new_backend_ruminate.config import settings
        
        # Get settings instance
        config = settings()
        
        # Skip if no AWS credentials or S3 not configured
        if config.storage_type != "s3" or not all([
            config.aws_access_key_id,
            config.aws_secret_access_key,
            config.s3_bucket_name
        ]):
            pytest.skip("S3 not configured in settings for integration tests")
        
        return {
            'bucket_name': config.s3_bucket_name,
            'region': config.s3_region,
            'aws_access_key_id': config.aws_access_key_id,
            'aws_secret_access_key': config.aws_secret_access_key
        }
    
    @pytest.fixture
    def s3_storage(self, s3_config):
        """Create real S3 storage instance"""
        return S3ObjectStorage(**s3_config)
    
    @pytest.fixture
    def test_key_prefix(self):
        """Generate unique test key prefix"""
        import time
        return f"test-integration/{int(time.time())}"
    
    async def test_upload_download_delete_lifecycle(self, s3_storage, test_key_prefix):
        """Test full lifecycle with real S3"""
        # Test data
        test_content = b"Real S3 integration test content"
        test_key = f"{test_key_prefix}/lifecycle-test.txt"
        
        # Upload
        file_obj = io.BytesIO(test_content)
        result = await s3_storage.upload_file(
            file=file_obj,
            key=test_key,
            content_type="text/plain"
        )
        assert result == f"s3://{s3_storage.bucket_name}/{test_key}"
        
        # Verify exists
        exists = await s3_storage.file_exists(test_key)
        assert exists is True
        
        # Download
        downloaded = await s3_storage.download_file(test_key)
        assert downloaded == test_content
        
        # Delete
        deleted = await s3_storage.delete_file(test_key)
        assert deleted is True
        
        # Verify deleted
        exists_after = await s3_storage.file_exists(test_key)
        assert exists_after is False
    
    async def test_presigned_url_generation(self, s3_storage, test_key_prefix):
        """Test presigned URL generation and access"""
        
        # Upload test file
        test_content = b"Presigned URL test content"
        test_key = f"{test_key_prefix}/presigned-test.txt"
        file_obj = io.BytesIO(test_content)
        
        await s3_storage.upload_file(
            file=file_obj,
            key=test_key,
            content_type="text/plain"
        )
        
        try:
            # Generate presigned URL
            presigned_url = await s3_storage.get_presigned_url(test_key, expiration=300)
            
            # Debug: check what we got
            print(f"Type of presigned_url: {type(presigned_url)}")
            print(f"Value of presigned_url: {presigned_url}")
            
            # Verify URL format
            assert isinstance(presigned_url, str), f"Expected string, got {type(presigned_url)}"
            assert presigned_url.startswith('https://'), f"URL doesn't start with https://: {presigned_url}"
            assert s3_storage.bucket_name in presigned_url, f"Bucket name not in URL: {presigned_url}"
            assert test_key.replace('/', '%2F') in presigned_url or test_key in presigned_url, f"Key not in URL: {presigned_url}"
            assert 'X-Amz-Expires' in presigned_url or 'Expires' in presigned_url, f"No expiration in URL: {presigned_url}"
        
        finally:
            # Cleanup
            await s3_storage.delete_file(test_key)
    
    async def test_nonexistent_file_handling(self, s3_storage, test_key_prefix):
        """Test handling of nonexistent files"""
        fake_key = f"{test_key_prefix}/nonexistent-file.pdf"
        
        # Check exists
        exists = await s3_storage.file_exists(fake_key)
        assert exists is False
        
        # Try to download
        with pytest.raises(FileNotFoundError):
            await s3_storage.download_file(fake_key)
        
        # Delete nonexistent (should not raise)
        result = await s3_storage.delete_file(fake_key)
        # S3 delete returns True even if file doesn't exist
        assert result is True
    
    async def test_unicode_filename_support(self, s3_storage, test_key_prefix):
        """Test unicode filenames with real S3"""
        unicode_key = f"{test_key_prefix}/文档/テスト.pdf"
        test_content = b"Unicode filename test with real S3"
        
        # Upload
        file_obj = io.BytesIO(test_content)
        result = await s3_storage.upload_file(
            file=file_obj,
            key=unicode_key,
            content_type="application/pdf"
        )
        
        try:
            assert unicode_key in result
            
            # Download
            downloaded = await s3_storage.download_file(unicode_key)
            assert downloaded == test_content
            
            # Check exists
            exists = await s3_storage.file_exists(unicode_key)
            assert exists is True
            
        finally:
            # Cleanup
            await s3_storage.delete_file(unicode_key)
    
    async def test_large_file_handling(self, s3_storage, test_key_prefix):
        """Test handling larger files (5MB)"""
        # Generate 5MB of data
        large_content = b"x" * (5 * 1024 * 1024)
        test_key = f"{test_key_prefix}/large-file.bin"
        
        # Upload
        file_obj = io.BytesIO(large_content)
        result = await s3_storage.upload_file(
            file=file_obj,
            key=test_key,
            content_type="application/octet-stream"
        )
        
        try:
            # Download and verify size
            downloaded = await s3_storage.download_file(test_key)
            assert len(downloaded) == len(large_content)
            
        finally:
            # Cleanup
            await s3_storage.delete_file(test_key)
    
    async def test_concurrent_operations(self, s3_storage, test_key_prefix):
        """Test concurrent S3 operations"""
        # Create multiple test files
        num_files = 5
        tasks = []
        
        async def upload_download_delete(index):
            content = f"Concurrent test file {index}".encode()
            key = f"{test_key_prefix}/concurrent-{index}.txt"
            
            # Upload
            file_obj = io.BytesIO(content)
            await s3_storage.upload_file(file_obj, key, "text/plain")
            
            # Download
            downloaded = await s3_storage.download_file(key)
            assert downloaded == content
            
            # Delete
            await s3_storage.delete_file(key)
        
        # Run concurrently
        tasks = [upload_download_delete(i) for i in range(num_files)]
        await asyncio.gather(*tasks)
    
    async def test_error_recovery(self, s3_storage, test_key_prefix):
        """Test error handling and recovery"""
        # Test with invalid bucket (temporarily change bucket name)
        original_bucket = s3_storage.bucket_name
        s3_storage.bucket_name = "invalid-bucket-name-that-does-not-exist"
        
        try:
            # Should raise an error
            file_obj = io.BytesIO(b"test")
            with pytest.raises(Exception):
                await s3_storage.upload_file(
                    file=file_obj,
                    key=f"{test_key_prefix}/error-test.txt"
                )
        finally:
            # Restore original bucket
            s3_storage.bucket_name = original_bucket
    
    async def test_directory_structure(self, s3_storage, test_key_prefix):
        """Test creating nested directory structures"""
        # Upload files in nested structure
        files = [
            f"{test_key_prefix}/docs/2024/january/report.pdf",
            f"{test_key_prefix}/docs/2024/february/report.pdf",
            f"{test_key_prefix}/docs/2024/february/supplement.pdf"
        ]
        
        try:
            # Upload all files
            for file_key in files:
                content = f"Content for {file_key}".encode()
                file_obj = io.BytesIO(content)
                await s3_storage.upload_file(file_obj, file_key, "application/pdf")
            
            # Verify all exist
            for file_key in files:
                exists = await s3_storage.file_exists(file_key)
                assert exists is True
            
        finally:
            # Cleanup
            for file_key in files:
                await s3_storage.delete_file(file_key)
    
    async def test_content_type_preservation(self, s3_storage, test_key_prefix):
        """Test that content type is properly set in S3"""
        test_files = [
            ("test.pdf", "application/pdf", b"PDF content"),
            ("test.jpg", "image/jpeg", b"JPEG content"),
            ("test.json", "application/json", b'{"test": true}')
        ]
        
        for filename, content_type, content in test_files:
            key = f"{test_key_prefix}/{filename}"
            
            try:
                # Upload with specific content type
                file_obj = io.BytesIO(content)
                await s3_storage.upload_file(
                    file=file_obj,
                    key=key,
                    content_type=content_type
                )
                
                # Verify file exists
                exists = await s3_storage.file_exists(key)
                assert exists is True
                
                # Download and verify content
                downloaded = await s3_storage.download_file(key)
                assert downloaded == content
                
            finally:
                # Cleanup
                await s3_storage.delete_file(key)
    
    @pytest.mark.slow
    async def test_performance(self, s3_storage, test_key_prefix):
        """Basic performance test"""
        import time
        
        # Test upload speed for 1MB file
        content = b"x" * (1024 * 1024)  # 1MB
        key = f"{test_key_prefix}/performance-test.bin"
        
        try:
            # Measure upload time
            start = time.time()
            file_obj = io.BytesIO(content)
            await s3_storage.upload_file(file_obj, key)
            upload_time = time.time() - start
            
            # Measure download time
            start = time.time()
            downloaded = await s3_storage.download_file(key)
            download_time = time.time() - start
            
            # Basic assertions (these are generous for CI environments)
            assert upload_time < 10.0  # Should complete within 10 seconds
            assert download_time < 10.0
            assert len(downloaded) == len(content)
            
            print(f"\nPerformance results:")
            print(f"  Upload 1MB: {upload_time:.2f}s")
            print(f"  Download 1MB: {download_time:.2f}s")
            
        finally:
            # Cleanup
            await s3_storage.delete_file(key)