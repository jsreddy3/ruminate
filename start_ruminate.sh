#!/bin/bash

echo "Starting Ruminate Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if PostgreSQL is already running on port 5432
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null ; then
    echo "PostgreSQL is already running on port 5432"
    # Check if it's the right database
    if docker ps --format "table {{.Names}}" | grep -q "ruminate-db\|local-postgres"; then
        echo "Using existing PostgreSQL container"
    else
        echo "Warning: Port 5432 is in use by another service"
        echo "Please stop the other service or update the port in docker-compose.yml"
    fi
else
    # Navigate to backend directory and start database
    echo "Starting PostgreSQL container..."
    cd new_backend_ruminate
    docker compose up -d db
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
            echo "PostgreSQL is ready!"
            break
        fi
        echo -n "."
        sleep 1
    done
    cd ..
fi

# Check if virtual environment exists
if [ ! -d "new_backend_ruminate/my_env" ]; then
    echo "Creating virtual environment..."
    python3 -m venv new_backend_ruminate/my_env
fi

# Activate virtual environment
source new_backend_ruminate/my_env/bin/activate

# Install dependencies if requirements.txt exists
if [ -f "new_backend_ruminate/requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip install -q -r new_backend_ruminate/requirements.txt
fi

# Start the backend server
echo "Starting Ruminate backend server..."
echo "Server will be available at http://localhost:8000"
echo "Press Ctrl+C to stop"
PYTHONPATH=. uvicorn new_backend_ruminate.main:app --reload --port 8000