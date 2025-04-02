from typing import List, Optional
from src.models.rumination.structured_insight import StructuredInsight

class InsightRepository:
    """Interface for storing and retrieving structured insights"""
    
    async def create_insight(self, insight: StructuredInsight) -> StructuredInsight:
        """Create a new insight"""
        raise NotImplementedError()
    
    async def get_block_insight(self, block_id: str) -> Optional[StructuredInsight]:
        """Get insight for a specific block"""
        raise NotImplementedError()
    
    async def get_document_insights(self, document_id: str) -> List[StructuredInsight]:
        """Get all insights for a document"""
        raise NotImplementedError()
    
    async def update_insight(self, insight: StructuredInsight) -> StructuredInsight:
        """Update an existing insight"""
        raise NotImplementedError()
    
    async def delete_insight(self, block_id: str) -> None:
        """Delete an insight"""
        raise NotImplementedError() 