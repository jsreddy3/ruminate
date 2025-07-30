FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY new_backend_ruminate/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy pyproject.toml for package installation
COPY pyproject.toml .

# Copy the entire backend package
COPY new_backend_ruminate/ ./new_backend_ruminate/

# Install the package in development mode so imports work correctly
RUN pip install -e .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["uvicorn", "new_backend_ruminate.main:app", "--host", "0.0.0.0", "--port", "8000"]