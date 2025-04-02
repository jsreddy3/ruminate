from pydantic import BaseModel as PydanticBaseModel
from datetime import datetime
from typing import Any

class BaseModel(PydanticBaseModel):
    """Base model for all models in the application"""
    
    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override model_dump to always handle datetime serialization"""
        # If mode is not specified and we're not explicitly excluding datetime conversion,
        # default to JSON-safe serialization
        if 'mode' not in kwargs and not kwargs.get('exclude_json_serialize'):
            kwargs['mode'] = 'json'
        
        # Remove our custom parameter if it exists
        kwargs.pop('exclude_json_serialize', None)
        return super().model_dump(**kwargs)

    class Config:
        from_attributes = True  # For SQLAlchemy compatibility
