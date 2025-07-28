#!/usr/bin/env python
"""
Script to run pytest with environment variables loaded from .env files
"""
import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Print initial environment variable values
print("\n===== BEFORE LOADING .ENV FILES =====")
print(f"OPENAI_API_KEY: {'Set (first chars: ' + os.environ.get('OPENAI_API_KEY', '')[:10] + '...)' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
print(f"MARKER_API_KEY: {'Set (first chars: ' + os.environ.get('MARKER_API_KEY', '')[:10] + '...)' if os.environ.get('MARKER_API_KEY') else 'Not set'}")

# Get the current directory and parent directory paths
current_dir = Path(__file__).parent.absolute()
parent_dir = current_dir.parent

# Try to load both .env files
env_files = [
    current_dir / ".env",  # new_backend_ruminate/.env
    parent_dir / ".env",   # ruminate/.env
]

for env_file in env_files:
    if env_file.exists():
        print(f"\nLoading .env file: {env_file}")
        # Use override=True to ensure values from the file take precedence
        load_dotenv(env_file, override=True)
        print(f"  .env file loaded successfully")
    else:
        print(f"\nWarning: .env file not found: {env_file}")

# Print final environment variable values
print("\n===== AFTER LOADING .ENV FILES =====")
print(f"OPENAI_API_KEY: {'Set (first chars: ' + os.environ.get('OPENAI_API_KEY', '')[:10] + '...)' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
print(f"MARKER_API_KEY: {'Set (first chars: ' + os.environ.get('MARKER_API_KEY', '')[:10] + '...)' if os.environ.get('MARKER_API_KEY') else 'Not set'}")

# Run pytest with all arguments passed to this script
print("\n===== RUNNING TESTS =====")
cmd = [sys.executable, '-m', 'pytest'] + sys.argv[1:]
result = subprocess.run(cmd)
sys.exit(result.returncode)
