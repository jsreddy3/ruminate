from typing import Dict, Any, List, Optional
from uuid import uuid4
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.document.entities.text_enhancement import TextEnhancement, TextEnhancementType
from new_backend_ruminate.domain.document.repositories.text_enhancement_repository_interface import TextEnhancementRepositoryInterface
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.context.prompts import definition_prompt


class TextEnhancementService:
    """Service for managing text enhancements (definitions, annotations, rabbitholes)"""
    
    def __init__(self, repo: TextEnhancementRepositoryInterface, llm: LLMService):
        self._repo = repo
        self._llm = llm
    
    async def get_all_for_document(self, document_id: str, user_id: str, session: AsyncSession) -> Dict[str, List[Dict[str, Any]]]:
        """Get all text enhancements for a document, grouped by type"""
        grouped = await self._repo.get_all_for_document_grouped(document_id, session)
        
        # Convert to dictionaries for API response
        result = {}
        for enhancement_type, enhancements in grouped.items():
            result[enhancement_type] = [e.to_dict() for e in enhancements]
        
        return result
    
    async def create_definition(self, 
                              document_id: str,
                              block_id: str,
                              term: str,
                              text_start_offset: int,
                              text_end_offset: int,
                              surrounding_text: Optional[str],
                              user_id: str,
                              session: AsyncSession) -> TextEnhancement:
        """Create a new definition"""
        # Check if definition already exists at this position
        existing = await self._repo.find_by_position(
            block_id, text_start_offset, text_end_offset, 
            TextEnhancementType.DEFINITION, session
        )
        
        if existing:
            return existing
        
        # Generate definition using LLM
        definition_text = await self._generate_definition(term, surrounding_text)
        
        # Create the enhancement
        enhancement = TextEnhancement(
            type=TextEnhancementType.DEFINITION,
            document_id=document_id,
            block_id=block_id,
            user_id=user_id,
            text=term,
            text_start_offset=text_start_offset,
            text_end_offset=text_end_offset,
            data={
                "term": term,
                "definition": definition_text,
                "context": surrounding_text
            }
        )
        
        return await self._repo.create(enhancement, session)
    
    async def create_annotation(self,
                               document_id: str,
                               block_id: str,
                               text: str,
                               note: str,
                               text_start_offset: int,
                               text_end_offset: int,
                               user_id: str,
                               session: AsyncSession) -> Optional[TextEnhancement]:
        """Create or update an annotation"""
        # Check if annotation exists at this position
        existing = await self._repo.find_by_position(
            block_id, text_start_offset, text_end_offset,
            TextEnhancementType.ANNOTATION, session
        )
        
        if existing:
            if note == "":
                # Delete annotation
                await self._repo.delete(existing.id, session)
                return None
            else:
                # Update annotation
                return await self._repo.update(
                    existing.id,
                    {"data": {"note": note}, "text": text},
                    session
                )
        
        # Create new annotation
        enhancement = TextEnhancement(
            type=TextEnhancementType.ANNOTATION,
            document_id=document_id,
            block_id=block_id,
            user_id=user_id,
            text=text,
            text_start_offset=text_start_offset,
            text_end_offset=text_end_offset,
            data={"note": note}
        )
        
        return await self._repo.create(enhancement, session)
    
    async def create_rabbithole_enhancement(self,
                                          conversation_id: str,
                                          document_id: str,
                                          block_id: str,
                                          selected_text: str,
                                          text_start_offset: int,
                                          text_end_offset: int,
                                          user_id: str,
                                          session: AsyncSession) -> TextEnhancement:
        """Create a rabbithole text enhancement (called after conversation is created)"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.RABBITHOLE,
            document_id=document_id,
            block_id=block_id,
            user_id=user_id,
            text=selected_text,
            text_start_offset=text_start_offset,
            text_end_offset=text_end_offset,
            data={"conversation_id": conversation_id}
        )
        
        return await self._repo.create(enhancement, session)
    
    async def delete_enhancement(self, enhancement_id: str, user_id: str, session: AsyncSession) -> bool:
        """Delete a text enhancement"""
        # TODO: Add user ownership check
        return await self._repo.delete(enhancement_id, session)
    
    async def _generate_definition(self, term: str, context: Optional[str]) -> str:
        """Generate a definition using LLM"""
        # Use the definition prompt from prompts
        prompt_text = definition_prompt(term, context)
        
        # Generate definition
        messages = [{"role": "user", "content": prompt_text}]
        response = await self._llm.generate_response(messages)
        
        return response.strip()