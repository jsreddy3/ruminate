# src/models/rumination/structured_insight.py

from pydantic import BaseModel
from typing import List, Optional

class Annotation(BaseModel):
    phrase: str
    insight: str

class StructuredInsight(BaseModel):
    block_id: str
    document_id: str
    page_number: Optional[int] = None
    insight: str
    annotations: Optional[List[Annotation]] = None
    conversation_history: List[dict]