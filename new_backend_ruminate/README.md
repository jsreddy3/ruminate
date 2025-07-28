# Ruminate Backend

A modern, async Python backend for the Ruminate conversational AI application, featuring branching conversations, agent capabilities, and real-time streaming.

## Prerequisites

- Python 3.10+
- Docker (for PostgreSQL)
- AWS credentials (for S3 storage)

## Project Structure

```
new_backend_ruminate/
├── api/                    # FastAPI routes and endpoints
├── context/               # Context building for conversations
├── domain/                # Domain models and business logic
├── infrastructure/        # Database, storage, and external services
├── services/              # Application services (conversation, agent, etc.)
├── tests/                 # Test suite
└── main.py               # Application entry point
```

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# API Keys
OPENAI_API_KEY=your_openai_api_key
MARKER_API_KEY=your_marker_api_key
GEMINI_API_KEY=your_gemini_key
GOOGLE_API_KEY=your_google_key

# Storage Configuration
DOCUMENT_STORAGE_TYPE=rds
FILE_STORAGE_TYPE=s3
DATA_DIR=local_db
STORAGE_DIR=local_storage
DB_PATH=sqlite.db

# AWS Configuration (for S3)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET=your_s3_bucket_name

# Database Configuration (optional - uses defaults if not provided)
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_NAME=ruminate
# DB_HOST=localhost
# DB_PORT=5432
```

### 3. Database Setup

#### Option A: Use PostgreSQL (Recommended for Production)

```bash
# Start PostgreSQL container
docker run -d \
  --name local-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:17

# The application will automatically use PostgreSQL if available
```

#### Option B: Use SQLite (Default for Development)

No setup required - SQLite database will be created automatically.

### 4. Run Database Migrations

```bash
# Navigate to the new_backend_ruminate directory
cd new_backend_ruminate

# Apply existing migrations
PYTHONPATH=. alembic upgrade head

# To create a new migration (if you've made schema changes)
PYTHONPATH=. alembic revision --autogenerate -m "Your migration message"

# To see migration history
PYTHONPATH=. alembic history

# To downgrade (rollback) one revision
PYTHONPATH=. alembic downgrade -1
```

**Note**: The PYTHONPATH=. is required so Alembic can find your domain models and infrastructure modules.

## Running Tests

### Running All Tests

```bash
# Run all tests with pytest
PYTHONPATH=. python -m pytest -v

# Run with coverage
PYTHONPATH=. python -m pytest --cov=. --cov-report=html
```

### Running Specific Test Categories

```bash
# Unit tests only
PYTHONPATH=. python -m pytest tests/test_*.py -v

# Agent tests
PYTHONPATH=. python -m pytest tests/agent/ -v

# Conversation tests
PYTHONPATH=. python -m pytest tests/test_conversation.py -v
```

### PostgreSQL Integration Tests

To verify PostgreSQL compatibility:

```bash
# Ensure PostgreSQL container is running
docker ps | grep postgres

# Run PostgreSQL integration test
python test_postgres_integration.py
```

## Test Configuration

### pytest.ini

The project includes a `pytest.ini` configuration file with:
- Async mode set to strict
- 2-second timeout for tests
- Live logging at DEBUG level
- Deprecation warnings ignored

### Test Database

Tests use an in-memory SQLite database by default (configured in `conftest.py`). Each test session gets a fresh database with all tables created.

## Development

### Running the Application

```bash
# Development mode with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### API Documentation

Once running, access the interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Architecture Highlights

### Branching Conversations
- Messages form a tree structure with versioning
- Each message can have multiple versions (edits)
- Active path is maintained via `active_child_id` pointers

### Real-time Streaming
- Server-Sent Events (SSE) for streaming AI responses
- In-process pub/sub system via EventStreamHub
- Background tasks for non-blocking AI generation

### Agent Capabilities
- Tool calling system with extensible tool registry
- Thought-Action-Answer loop for complex tasks
- Streaming updates for agent progress

## Common Issues

### PostgreSQL CTE Error
If you encounter "recursive reference to query must not appear within its non-recursive term":
- This has been fixed in the latest version
- The fix uses a simplified CTE that only follows the active_child_id chain

### Database Connection Issues
- Ensure PostgreSQL container is running: `docker ps`
- Check database credentials in `.env` file
- Verify network connectivity to database host

### Test Failures
- Run `PYTHONPATH=. alembic upgrade head` to ensure database schema is up to date
- Check that all required environment variables are set
- Ensure PostgreSQL is running if testing PostgreSQL-specific features

## Contributing

1. Create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass
4. Submit a pull request

## License

[Your License Here]