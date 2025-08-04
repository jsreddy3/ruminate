#!/bin/bash

# Activate the virtual environment
source new_backend_ruminate/my_env/bin/activate

# Run the uvicorn server
PYTHONPATH=. uvicorn new_backend_ruminate.main:app --reload --port 8000