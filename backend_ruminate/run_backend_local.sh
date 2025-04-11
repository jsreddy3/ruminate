#!/bin/bash
# run_backend_local.sh - Runs the backend with a local SQLite database

# Set environment variables for local development
export DOCUMENT_STORAGE_TYPE=sqlite
export FILE_STORAGE_TYPE=local
export DATA_DIR=local_db
export STORAGE_DIR=local_storage
export DB_PATH=sqlite.db

# Create necessary directories if they don't exist
mkdir -p "$DATA_DIR"
mkdir -p "$STORAGE_DIR"

echo "Starting backend with local SQLite database..."
echo "Data will be stored in $DATA_DIR and $STORAGE_DIR"

# Run the backend
myenv/bin/python3.10 -m src.main
