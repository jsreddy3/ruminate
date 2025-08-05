"""
Security middleware for adding security headers and Content Security Policy
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        
        # Define Content Security Policy
        # Note: More permissive for development - tighten for production
        self.csp_policy = (
            "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com localhost:* http://localhost:*; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com localhost:* http://localhost:*; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data: localhost:* http://localhost:*; "
            "img-src 'self' data: blob: https: localhost:* http://localhost:*; "
            "connect-src 'self' https: http: wss: ws: localhost:* http://localhost:*; "
            "media-src 'self' blob: localhost:* http://localhost:*; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'none'"
        )

    async def dispatch(self, request: Request, call_next):
        # Process the request
        start_time = time.time()
        
        # Call the next middleware/handler
        response = await call_next(request)
        
        # Add security headers to the response
        self.add_security_headers(response, request)
        
        # Add processing time header (optional, for debugging)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
    
    def add_security_headers(self, response: Response, request: Request):
        """Add comprehensive security headers to the response"""
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = self.csp_policy
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # XSS Protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Strict Transport Security (HTTPS only)
        # Note: Only add this if you're serving over HTTPS
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Permissions Policy (formerly Feature Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "speaker=()"
        )
        
        # Remove server information disclosure
        response.headers["Server"] = "Ruminate-API"
        
        # CORS security headers (if needed)
        # These should be handled by your CORS middleware, but adding for completeness
        if "Access-Control-Allow-Origin" not in response.headers:
            # Only set if not already set by CORS middleware
            response.headers["Access-Control-Allow-Origin"] = "*"  # Adjust as needed
        
        # Prevent caching of sensitive data
        if request.url.path.startswith("/auth") or "token" in str(request.url):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware
    Note: For production, consider using Redis-based rate limiting
    """
    
    def __init__(self, app: ASGIApp, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.client_requests = {}  # Simple in-memory store
        
    async def dispatch(self, request: Request, call_next):
        client_ip = self.get_client_ip(request)
        current_time = time.time()
        
        # Clean old entries (older than 1 minute)
        self.cleanup_old_requests(current_time)
        
        # Check rate limit for this client
        if self.is_rate_limited(client_ip, current_time):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."}
            )
        
        # Record this request
        self.record_request(client_ip, current_time)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_minute - len(self.client_requests.get(client_ip, [])))
        )
        
        return response
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check for forwarded headers (if behind proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"
    
    def cleanup_old_requests(self, current_time: float):
        """Remove requests older than 1 minute"""
        cutoff_time = current_time - 60  # 1 minute ago
        
        for client_ip in list(self.client_requests.keys()):
            self.client_requests[client_ip] = [
                req_time for req_time in self.client_requests[client_ip]
                if req_time > cutoff_time
            ]
            
            # Remove empty entries
            if not self.client_requests[client_ip]:
                del self.client_requests[client_ip]
    
    def is_rate_limited(self, client_ip: str, current_time: float) -> bool:
        """Check if client has exceeded rate limit"""
        if client_ip not in self.client_requests:
            return False
        
        # Clean up old requests for this client first
        cutoff_time = current_time - 60  # 1 minute ago
        self.client_requests[client_ip] = [
            req_time for req_time in self.client_requests[client_ip]
            if req_time > cutoff_time
        ]
        
        return len(self.client_requests[client_ip]) >= self.requests_per_minute
    
    def record_request(self, client_ip: str, current_time: float):
        """Record a request for the client"""
        if client_ip not in self.client_requests:
            self.client_requests[client_ip] = []
        
        self.client_requests[client_ip].append(current_time)


class FileUploadSecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware specifically for file upload endpoints
    """
    
    def __init__(self, app: ASGIApp, max_file_size: int = 100 * 1024 * 1024):  # 100MB
        super().__init__(app)
        self.max_file_size = max_file_size
    
    async def dispatch(self, request: Request, call_next):
        # Check if this is a file upload request
        if request.method == "POST" and "/documents" in str(request.url.path):
            # Check Content-Length header for file size
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_file_size:
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": f"File too large. Maximum size allowed: {self.max_file_size} bytes"
                    }
                )
        
        return await call_next(request)