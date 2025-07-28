import os
import pytest

def test_print_api_keys():
    """
    Simple test to print first 20 characters of API keys.
    This helps verify which environment variables are being used.
    """
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    marker_key = os.environ.get("MARKER_API_KEY", "")
    
    print("\n" + "=" * 80)
    print("*** API KEY CHECK ***")
    print(f"OPENAI_API_KEY (first 20 chars): '{openai_key[:20]}'" if openai_key else "OPENAI_API_KEY: Not set")
    print(f"MARKER_API_KEY (first 20 chars): '{marker_key[:20]}'" if marker_key else "MARKER_API_KEY: Not set")
    print("=" * 80)
    
    # Make the test pass regardless of the API keys
    assert True
