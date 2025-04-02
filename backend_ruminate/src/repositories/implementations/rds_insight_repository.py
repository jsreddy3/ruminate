from typing import List, Optional
import logging
from sqlalchemy import select, insert, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from src.models.rumination.structured_insight import StructuredInsight, Annotation, InsightModel
from src.repositories.interfaces.insight_repository import InsightRepository

logger = logging.getLogger(__name__)

class RDSInsightRepository(InsightRepository):
    """PostgreSQL implementation of InsightRepository using SQLAlchemy."""
    
    def __init__(self, session_factory):
        """Initialize RDS insight repository.
        
        Args:
            session_factory: SQLAlchemy session factory for database operations
        """
        self.session_factory = session_factory
        
    async def create_insight(self, insight: StructuredInsight) -> StructuredInsight:
        """Create a new insight"""
        local_session = False
        session = None
        
        try:
            session = self.session_factory()
            local_session = True
            
            # First check if insight exists
            existing = await self.get_block_insight(insight.block_id, session)
            if existing:
                return await self.update_insight(insight, session)
                
            # Prepare annotations as JSON-serializable list
            annotations_list = []
            if insight.annotations:
                annotations_list = [a.dict() for a in insight.annotations]
                
            # Create new insight
            db_insight = InsightModel(
                block_id=insight.block_id,
                document_id=insight.document_id,
                page_number=insight.page_number,
                insight=insight.insight,
                annotations=annotations_list,
                conversation_history=insight.conversation_history
            )
            
            session.add(db_insight)
            await session.commit()
            
            return insight
        except IntegrityError:
            if session:
                await session.rollback()
            # If we hit an integrity error, try updating instead
            return await self.update_insight(insight, session)
        except Exception as e:
            if session and local_session:
                await session.rollback()
            logger.error(f"Error creating insight: {str(e)}")
            raise
        finally:
            if session and local_session:
                await session.close()
    
    async def get_block_insight(self, block_id: str, session: Optional[AsyncSession] = None) -> Optional[StructuredInsight]:
        """Get insight for a specific block"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for insight
            result = await session.execute(
                select(InsightModel).where(InsightModel.block_id == block_id)
            )
            insight_model = result.scalar_one_or_none()
            
            if not insight_model:
                return None
                
            # Convert annotations from JSON to Annotation objects
            annotations = []
            if insight_model.annotations:
                annotations = [Annotation(**a) for a in insight_model.annotations]
                
            # Return structured insight
            return StructuredInsight(
                block_id=insight_model.block_id,
                document_id=insight_model.document_id,
                page_number=insight_model.page_number,
                insight=insight_model.insight,
                annotations=annotations,
                conversation_history=insight_model.conversation_history or []
            )
        except Exception as e:
            logger.error(f"Error getting insight: {str(e)}")
            raise
        finally:
            if local_session and session:
                await session.close()
    
    async def get_document_insights(self, document_id: str, session: Optional[AsyncSession] = None) -> List[StructuredInsight]:
        """Get all insights for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for insights
            result = await session.execute(
                select(InsightModel).where(InsightModel.document_id == document_id)
            )
            insight_models = result.scalars().all()
            
            # Convert to structured insights
            insights = []
            for model in insight_models:
                # Convert annotations from JSON to Annotation objects
                annotations = []
                if model.annotations:
                    annotations = [Annotation(**a) for a in model.annotations]
                    
                insights.append(StructuredInsight(
                    block_id=model.block_id,
                    document_id=model.document_id,
                    page_number=model.page_number,
                    insight=model.insight,
                    annotations=annotations,
                    conversation_history=model.conversation_history or []
                ))
            
            return insights
        except Exception as e:
            logger.error(f"Error getting document insights: {str(e)}")
            raise
        finally:
            if local_session and session:
                await session.close()
    
    async def update_insight(self, insight: StructuredInsight, session: Optional[AsyncSession] = None) -> StructuredInsight:
        """Update an existing insight"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Check if insight exists
            result = await session.execute(
                select(InsightModel).where(InsightModel.block_id == insight.block_id)
            )
            db_insight = result.scalar_one_or_none()
            
            # If it doesn't exist, create it
            if not db_insight:
                if local_session:
                    await session.close()
                return await self.create_insight(insight)
            
            # Prepare annotations as JSON-serializable list
            annotations_list = []
            if insight.annotations:
                annotations_list = [a.dict() for a in insight.annotations]
            
            # Update insight
            db_insight.document_id = insight.document_id
            db_insight.page_number = insight.page_number
            db_insight.insight = insight.insight
            db_insight.annotations = annotations_list
            db_insight.conversation_history = insight.conversation_history
            
            await session.commit()
            
            return insight
        except Exception as e:
            if session:
                await session.rollback()
            logger.error(f"Error updating insight: {str(e)}")
            raise
        finally:
            if local_session and session:
                await session.close()
    
    async def delete_insight(self, block_id: str, session: Optional[AsyncSession] = None) -> None:
        """Delete an insight"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for insight
            result = await session.execute(
                select(InsightModel).where(InsightModel.block_id == block_id)
            )
            db_insight = result.scalar_one_or_none()
            
            # If it exists, delete it
            if db_insight:
                await session.delete(db_insight)
                await session.commit()
        except Exception as e:
            if session:
                await session.rollback()
            logger.error(f"Error deleting insight: {str(e)}")
            raise
        finally:
            if local_session and session:
                await session.close()
