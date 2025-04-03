from typing import List, Dict, Any, Optional
from pydantic import Field
from datetime import datetime
from uuid import uuid4
from src.models.base.base_model import BaseModel
from sqlalchemy import Column, String, Integer, JSON, DateTime
from src.database.base import Base

# Pydantic model for API and business logic
class ChunkIndex(BaseModel):
    """
    Represents the analysis results for a document chunk.
    Stores argument elements extracted from legal text analysis.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    chunk_id: str  # Foreign key to Chunk
    document_id: str  # Redundant with Chunk for easier querying
    sequence: int = 0  # The sequence number of the chunk in the document
    summary: str = ""  # Summary of the chunk content
    authority_references: List[Dict[str, Any]] = []
    contested_definitions: List[Dict[str, Any]] = []
    argumentative_moves: List[Dict[str, Any]] = []
    counter_responses: List[Dict[str, Any]] = []
    core_principles: List[Dict[str, Any]] = []
    identity_claims: List[Dict[str, Any]] = []
    institutional_functions: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        orm_mode = True
        
    def get(self, key, default=None):
        """Provide dictionary-like access to attributes"""
        return getattr(self, key, default)
        
    def dict(self, *args, **kwargs):
        """Override the default dict method to include data attribute"""
        # Get the standard dictionary
        result = super().dict(*args, **kwargs)
        # Add a data field for compatibility with API code
        result["data"] = result
        return result
    
    @classmethod
    def from_analysis_results(cls, chunk_id: str, document_id: str, sequence: int, results: Dict[str, Any]) -> 'ChunkIndex':
        """
        Create a ChunkIndex from the analysis results returned by _analyze_chunk.
        
        Args:
            chunk_id: ID of the chunk that was analyzed
            document_id: ID of the document the chunk belongs to
            sequence: Sequence number of the chunk in the document
            results: Results from _analyze_chunk method
            
        Returns:
            ChunkIndex instance
        """
        # Ensure all required fields are present
        all_fields = [
            "SUMMARY",
            "AUTHORITY_REFERENCES", 
            "CONTESTED_DEFINITIONS", 
            "ARGUMENTATIVE_MOVES", 
            "COUNTER_RESPONSES", 
            "CORE_PRINCIPLES", 
            "IDENTITY_CLAIMS", 
            "INSTITUTIONAL_FUNCTIONS"
        ]
        
        # Map results to the model's field names (convert from uppercase to lowercase)
        mapped_results = {
            "summary": results.get("SUMMARY", ""),
            "authority_references": results.get("AUTHORITY_REFERENCES", []),
            "contested_definitions": results.get("CONTESTED_DEFINITIONS", []),
            "argumentative_moves": results.get("ARGUMENTATIVE_MOVES", []),
            "counter_responses": results.get("COUNTER_RESPONSES", []),
            "core_principles": results.get("CORE_PRINCIPLES", []),
            "identity_claims": results.get("IDENTITY_CLAIMS", []),
            "institutional_functions": results.get("INSTITUTIONAL_FUNCTIONS", []),
        }
        
        return cls(
            chunk_id=chunk_id,
            document_id=document_id,
            sequence=sequence,
            **mapped_results
        )

# SQLAlchemy model for database persistence
class ChunkIndexModel(Base):
    __tablename__ = "chunk_indices"
    
    id = Column(String, primary_key=True)
    chunk_id = Column(String, nullable=False, unique=True, index=True)
    document_id = Column(String, nullable=False, index=True)
    sequence = Column(Integer, default=0)
    summary = Column(String, nullable=True)
    authority_references = Column(JSON, default=list)
    contested_definitions = Column(JSON, default=list)
    argumentative_moves = Column(JSON, default=list)
    counter_responses = Column(JSON, default=list)
    core_principles = Column(JSON, default=list)
    identity_claims = Column(JSON, default=list)
    institutional_functions = Column(JSON, default=list)
    created_at = Column(String)  # Store as ISO format string
    updated_at = Column(String)  # Store as ISO format string