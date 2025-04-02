# src/models/rumination/structured_insight.py

from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import Column, String, Integer, JSON
from src.database.base import Base

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

# SQLAlchemy model for storing structured insights
class InsightModel(Base):
    __tablename__ = "insights"

    block_id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False, index=True)
    page_number = Column(Integer, nullable=True)
    insight = Column(String, nullable=False)
    annotations = Column(JSON, nullable=True)
    conversation_history = Column(JSON, nullable=True)