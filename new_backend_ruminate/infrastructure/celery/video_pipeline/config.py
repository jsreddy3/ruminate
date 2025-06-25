import os
from pathlib import Path
from typing import Dict, Any
from new_backend_ruminate.config import settings

def load_config() -> Dict[str, Any]:
    """
    Load configuration for video pipeline.
    This creates a config structure compatible with the original pipeline.
    """
    return {
        "pipeline": {
            "num_scenes": 2,  # Default number of scenes
            "scene_duration": 5,  # Default scene duration in seconds
            "scene_parsing": {
                "min_scenes": 1,
                "max_scenes": 2,
                "scene_duration_seconds": 5,
                "model": "gpt-4o-mini",
                "temperature": 0.7,
            },
        },
        "storage": {
            "local_path": "./output",  # Local storage for video files
            "s3_bucket": settings().s3_bucket,
            "s3_region": settings().aws_region,
        },
        "models": {
            "parser": "gpt-4o-mini",
            "image": "dall-e-2",  # Options: dall-e-2, dall-e-3, gpt-4
            "audio": "gpt-4o-mini",
        },
        "costs": {
            "gpt-4o-mini": {"input": 0.150, "output": 0.600},  # per 1M tokens
            "dall-e-2": 0.020,  # per image
            "dall-e-3": 0.040,  # per image
            "tts": 0.015,  # per 1K characters
        }
    }

def get_openai_api_key() -> str:
    """Get OpenAI API key from settings."""
    return settings().openai_api_key

CONFIG = load_config()
OPENAI_API_KEY = get_openai_api_key()