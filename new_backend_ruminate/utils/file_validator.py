"""
File validation utilities for secure file upload handling.
Provides comprehensive validation for PDF files including MIME type checking,
file structure validation, and size limits.
"""

import magic
import PyPDF2
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile
import io


class FileValidationError(Exception):
    """Custom exception for file validation errors"""
    pass


class PDFValidator:
    """Comprehensive PDF file validator with security checks"""
    
    # File size limits (in bytes)
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    MIN_FILE_SIZE = 1024  # 1KB minimum
    
    # Allowed MIME types for PDF files
    ALLOWED_MIME_TYPES = {
        'application/pdf',
        'application/x-pdf',
        'application/acrobat',
        'applications/vnd.pdf',
        'text/pdf',
        'text/x-pdf'
    }
    
    # PDF magic numbers (file signatures)
    PDF_SIGNATURES = [
        b'%PDF-1.',  # Standard PDF signature
        b'%PDF-2.',  # PDF 2.0 signature
    ]

    @classmethod
    def validate_pdf_file(cls, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """
        Comprehensive PDF file validation
        
        Args:
            file: FastAPI UploadFile object
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Read file content for validation
            file_content = file.file.read()
            file.file.seek(0)  # Reset file pointer
            
            # 1. File size validation
            if not cls._validate_file_size(file_content):
                return False, f"File size must be between {cls.MIN_FILE_SIZE} bytes and {cls.MAX_FILE_SIZE} bytes"
            
            # 2. File extension validation
            if not cls._validate_file_extension(file.filename):
                return False, "File must have a .pdf extension"
            
            # 3. MIME type validation using python-magic
            if not cls._validate_mime_type(file_content):
                return False, "File is not a valid PDF (MIME type check failed)"
            
            # 4. PDF magic number validation
            if not cls._validate_pdf_signature(file_content):
                return False, "File is not a valid PDF (signature check failed)"
            
            # 5. PDF structure validation
            structure_valid, structure_error = cls._validate_pdf_structure(file_content)
            if not structure_valid:
                return False, f"Invalid PDF structure: {structure_error}"
            
            return True, None
            
        except Exception as e:
            return False, f"File validation error: {str(e)}"
    
    @classmethod
    def validate_bytes(cls, file_content: bytes, filename: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """Validate a PDF from raw bytes (used in worker).
        Returns (is_valid, error_message)."""
        try:
            # 1. File size
            if not cls._validate_file_size(file_content):
                return False, f"File size must be between {cls.MIN_FILE_SIZE} bytes and {cls.MAX_FILE_SIZE} bytes"
            # 2. Optional extension hint
            if filename is not None and not cls._validate_file_extension(filename):
                return False, "File must have a .pdf extension"
            # 3. MIME
            if not cls._validate_mime_type(file_content):
                return False, "File is not a valid PDF (MIME type check failed)"
            # 4. Signature
            if not cls._validate_pdf_signature(file_content):
                return False, "File is not a valid PDF (signature check failed)"
            # 5. Structure
            structure_valid, structure_error = cls._validate_pdf_structure(file_content)
            if not structure_valid:
                return False, f"Invalid PDF structure: {structure_error}"
            return True, None
        except Exception as e:
            return False, f"File validation error: {str(e)}"
    
    @classmethod
    def _validate_file_size(cls, file_content: bytes) -> bool:
        """Validate file size is within acceptable limits"""
        file_size = len(file_content)
        return cls.MIN_FILE_SIZE <= file_size <= cls.MAX_FILE_SIZE
    
    @classmethod
    def _validate_file_extension(cls, filename: Optional[str]) -> bool:
        """Validate file has correct extension"""
        if not filename:
            return False
        return filename.lower().endswith('.pdf')
    
    @classmethod
    def _validate_mime_type(cls, file_content: bytes) -> bool:
        """Validate MIME type using python-magic"""
        try:
            mime_type = magic.from_buffer(file_content, mime=True)
            return mime_type in cls.ALLOWED_MIME_TYPES
        except Exception:
            # If magic fails, fall back to signature check
            return True
    
    @classmethod
    def _validate_pdf_signature(cls, file_content: bytes) -> bool:
        """Validate PDF file signature (magic numbers)"""
        if len(file_content) < 8:
            return False
        
        # Check for PDF signatures at the beginning of the file
        for signature in cls.PDF_SIGNATURES:
            if file_content.startswith(signature):
                return True
        
        return False
    
    @classmethod
    def _validate_pdf_structure(cls, file_content: bytes) -> Tuple[bool, Optional[str]]:
        """Validate PDF internal structure using PyPDF2"""
        try:
            # Create a BytesIO object from file content
            pdf_buffer = io.BytesIO(file_content)
            
            # Try to read PDF with PyPDF2
            pdf_reader = PyPDF2.PdfReader(pdf_buffer)
            
            # Basic structure checks
            if len(pdf_reader.pages) == 0:
                return False, "PDF has no pages"
            
            if len(pdf_reader.pages) > 10000:  # Reasonable upper limit
                return False, "PDF has too many pages (>10000)"
            
            # Try to access first page to ensure PDF is not corrupted
            first_page = pdf_reader.pages[0]
            
            # Check if we can extract basic info (this will fail on corrupted PDFs)
            _ = first_page.mediabox
            
            return True, None
            
        except PyPDF2.errors.PdfReadError as e:
            return False, f"Corrupted or invalid PDF: {str(e)}"
        except Exception as e:
            return False, f"PDF structure validation failed: {str(e)}"

    @classmethod
    def validate_and_raise(cls, file: UploadFile) -> None:
        """
        Validate PDF file and raise HTTPException if invalid
        
        Args:
            file: FastAPI UploadFile object
            
        Raises:
            HTTPException: If file validation fails
        """
        is_valid, error_message = cls.validate_pdf_file(file)
        
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid PDF file: {error_message}"
            )


class SecurityScanner:
    """Additional security scanning utilities"""
    
    # High-risk patterns that should always be blocked
    DANGEROUS_PATTERNS = [
        b'/JavaScript',
        b'/Launch',
        b'/EmbeddedFile',
        b'/RichMedia',
        b'/Flash',
        b'<script',
        b'javascript:',
        b'eval(',
        b'document.write'
    ]
    
    # Medium-risk patterns that might be legitimate in some contexts
    SUSPICIOUS_PATTERNS = [
        b'/JS',
        b'/Action',
        b'/URI'
    ]
    
    @classmethod
    def scan_for_dangerous_content(cls, file_content: bytes) -> Tuple[bool, list]:
        """
        Scan PDF content for dangerous patterns that should always be blocked
        
        Args:
            file_content: PDF file content as bytes
            
        Returns:
            Tuple of (has_dangerous_content, list_of_found_patterns)
        """
        found_patterns = []
        
        for pattern in cls.DANGEROUS_PATTERNS:
            if pattern in file_content:
                found_patterns.append(pattern.decode('utf-8', errors='ignore'))
        
        return len(found_patterns) > 0, found_patterns
    
    @classmethod
    def scan_for_suspicious_content(cls, file_content: bytes) -> Tuple[bool, list]:
        """
        Scan PDF content for suspicious patterns (informational only)
        
        Args:
            file_content: PDF file content as bytes
            
        Returns:
            Tuple of (has_suspicious_content, list_of_found_patterns)
        """
        found_patterns = []
        
        for pattern in cls.SUSPICIOUS_PATTERNS:
            if pattern in file_content:
                found_patterns.append(pattern.decode('utf-8', errors='ignore'))
        
        return len(found_patterns) > 0, found_patterns
    
    @classmethod
    def is_pdf_safe(cls, file_content: bytes) -> Tuple[bool, Optional[str]]:
        """
        Determine if PDF is safe based on content analysis
        
        Args:
            file_content: PDF file content as bytes
            
        Returns:
            Tuple of (is_safe, warning_message)
        """
        # First check for dangerous content - these should always be blocked
        has_dangerous, dangerous_patterns = cls.scan_for_dangerous_content(file_content)
        if has_dangerous:
            return False, f"Contains dangerous content: {', '.join(dangerous_patterns)}"
        
        # Then check for suspicious content - allow but warn
        has_suspicious, suspicious_patterns = cls.scan_for_suspicious_content(file_content)
        if has_suspicious:
            return True, f"Contains potentially suspicious content: {', '.join(suspicious_patterns)}"
        
        return True, None