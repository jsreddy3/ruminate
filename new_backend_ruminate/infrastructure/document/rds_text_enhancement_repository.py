from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from new_backend_ruminate.domain.document.repositories.text_enhancement_repository_interface import TextEnhancementRepositoryInterface
from new_backend_ruminate.domain.document.entities.text_enhancement import TextEnhancement, TextEnhancementType
from .text_enhancement_models import TextEnhancementModel


class RDSTextEnhancementRepository(TextEnhancementRepositoryInterface):
    """PostgreSQL implementation of TextEnhancementRepository"""
    
    async def create(self, enhancement: TextEnhancement, session: AsyncSession) -> TextEnhancement:
        """Create a new text enhancement"""
        model = TextEnhancementModel(
            id=enhancement.id,
            type=enhancement.type,
            document_id=enhancement.document_id,
            block_id=enhancement.block_id,
            user_id=enhancement.user_id,
            text=enhancement.text,
            text_start_offset=enhancement.text_start_offset,
            text_end_offset=enhancement.text_end_offset,
            data=enhancement.data,
            created_at=enhancement.created_at,
            updated_at=enhancement.updated_at
        )
        
        session.add(model)
        await session.flush()
        
        return self._model_to_entity(model)
    
    async def get(self, enhancement_id: str, session: AsyncSession) -> Optional[TextEnhancement]:
        """Get a text enhancement by ID"""
        result = await session.execute(
            select(TextEnhancementModel).where(TextEnhancementModel.id == enhancement_id)
        )
        model = result.scalar_one_or_none()
        
        return self._model_to_entity(model) if model else None
    
    async def get_by_document(self, document_id: str, session: AsyncSession) -> List[TextEnhancement]:
        """Get all text enhancements for a document"""
        result = await session.execute(
            select(TextEnhancementModel)
            .where(TextEnhancementModel.document_id == document_id)
            .order_by(TextEnhancementModel.block_id, TextEnhancementModel.text_start_offset)
        )
        models = result.scalars().all()
        
        return [self._model_to_entity(m) for m in models]
    
    async def get_by_block(self, block_id: str, session: AsyncSession) -> List[TextEnhancement]:
        """Get all text enhancements for a block"""
        result = await session.execute(
            select(TextEnhancementModel)
            .where(TextEnhancementModel.block_id == block_id)
            .order_by(TextEnhancementModel.text_start_offset)
        )
        models = result.scalars().all()
        
        return [self._model_to_entity(m) for m in models]
    
    async def get_by_type(self, document_id: str, enhancement_type: TextEnhancementType, session: AsyncSession) -> List[TextEnhancement]:
        """Get all text enhancements of a specific type for a document"""
        result = await session.execute(
            select(TextEnhancementModel)
            .where(and_(
                TextEnhancementModel.document_id == document_id,
                TextEnhancementModel.type == enhancement_type
            ))
            .order_by(TextEnhancementModel.block_id, TextEnhancementModel.text_start_offset)
        )
        models = result.scalars().all()
        
        return [self._model_to_entity(m) for m in models]
    
    async def update(self, enhancement_id: str, updates: Dict[str, Any], session: AsyncSession) -> Optional[TextEnhancement]:
        """Update a text enhancement"""
        result = await session.execute(
            select(TextEnhancementModel).where(TextEnhancementModel.id == enhancement_id)
        )
        model = result.scalar_one_or_none()
        
        if not model:
            return None
        
        # Update allowed fields
        allowed_updates = {"text", "data", "text_start_offset", "text_end_offset"}
        for key, value in updates.items():
            if key in allowed_updates and hasattr(model, key):
                setattr(model, key, value)
        
        await session.flush()
        
        return self._model_to_entity(model)
    
    async def delete(self, enhancement_id: str, session: AsyncSession) -> bool:
        """Delete a text enhancement"""
        result = await session.execute(
            select(TextEnhancementModel).where(TextEnhancementModel.id == enhancement_id)
        )
        model = result.scalar_one_or_none()
        
        if not model:
            return False
        
        await session.delete(model)
        await session.flush()
        
        return True
    
    async def find_by_position(self, block_id: str, start_offset: int, end_offset: int, 
                              enhancement_type: Optional[TextEnhancementType], session: AsyncSession) -> Optional[TextEnhancement]:
        """Find a text enhancement by its position in a block"""
        query = select(TextEnhancementModel).where(and_(
            TextEnhancementModel.block_id == block_id,
            TextEnhancementModel.text_start_offset == start_offset,
            TextEnhancementModel.text_end_offset == end_offset
        ))
        
        if enhancement_type:
            query = query.where(TextEnhancementModel.type == enhancement_type)
        
        result = await session.execute(query)
        model = result.scalar_one_or_none()
        
        return self._model_to_entity(model) if model else None
    
    async def get_all_for_document_grouped(self, document_id: str, session: AsyncSession) -> Dict[str, List[TextEnhancement]]:
        """Get all text enhancements for a document, grouped by type"""
        result = await session.execute(
            select(TextEnhancementModel)
            .where(TextEnhancementModel.document_id == document_id)
            .order_by(TextEnhancementModel.block_id, TextEnhancementModel.text_start_offset)
        )
        models = result.scalars().all()
        
        grouped = {
            "definitions": [],
            "annotations": [],
            "rabbitholes": []
        }
        
        for model in models:
            enhancement = self._model_to_entity(model)
            if model.type == TextEnhancementType.DEFINITION:
                grouped["definitions"].append(enhancement)
            elif model.type == TextEnhancementType.ANNOTATION:
                grouped["annotations"].append(enhancement)
            elif model.type == TextEnhancementType.RABBITHOLE:
                grouped["rabbitholes"].append(enhancement)
        
        return grouped
    
    def _model_to_entity(self, model: TextEnhancementModel) -> TextEnhancement:
        """Convert SQLAlchemy model to domain entity"""
        return TextEnhancement(
            id=model.id,
            type=model.type,
            document_id=model.document_id,
            block_id=model.block_id,
            user_id=model.user_id,
            text=model.text,
            text_start_offset=model.text_start_offset,
            text_end_offset=model.text_end_offset,
            data=model.data or {},
            created_at=model.created_at,
            updated_at=model.updated_at
        )