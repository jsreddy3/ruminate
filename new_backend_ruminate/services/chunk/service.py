# new_backend_ruminate/services/chunk/service.py
from __future__ import annotations
from typing import List, Optional, Tuple
from uuid import uuid4
from datetime import datetime
import asyncio
import re

from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.document.entities.chunk import Chunk, ChunkStatus
from new_backend_ruminate.domain.document.entities import Block
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.domain.conversation.entities.message import Message, Role


class ChunkService:
    """Service for managing document chunks and their summaries"""
    
    PAGES_PER_CHUNK = 20
    
    def __init__(
        self,
        repo: DocumentRepositoryInterface,
        llm: Optional[LLMService] = None
    ) -> None:
        self._repo = repo
        self._llm = llm
    
    async def create_chunks_for_document(
        self,
        document_id: str,
        total_pages: int,
        session: AsyncSession
    ) -> List[Chunk]:
        """
        Create chunk records for a document based on total pages.
        Each chunk covers 20 pages.
        """
        chunks = []
        num_chunks = (total_pages + self.PAGES_PER_CHUNK - 1) // self.PAGES_PER_CHUNK
        
        for i in range(num_chunks):
            start_page = i * self.PAGES_PER_CHUNK
            end_page = min((i + 1) * self.PAGES_PER_CHUNK, total_pages)
            
            chunk = Chunk(
                id=str(uuid4()),
                document_id=document_id,
                chunk_index=i,
                start_page=start_page,
                end_page=end_page,
                status=ChunkStatus.UNPROCESSED,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            chunks.append(chunk)
        
        # Save all chunks to database
        created_chunks = await self._repo.create_chunks(chunks, session)
        return created_chunks
    
    async def assign_blocks_to_chunks(
        self,
        document_id: str,
        session: AsyncSession
    ) -> None:
        """
        Assign existing blocks to their corresponding chunks based on page numbers.
        """
        # Get all chunks and blocks for the document
        chunks = await self._repo.get_chunks_by_document(document_id, session)
        blocks = await self._repo.get_blocks_by_document(document_id, session)
        
        # Create a mapping of page ranges to chunk IDs
        chunk_map = {}
        for chunk in chunks:
            for page_num in range(chunk.start_page, chunk.end_page):
                chunk_map[page_num] = chunk.id
        
        # Update each block with its chunk_id
        for block in blocks:
            if block.page_number is not None and block.page_number in chunk_map:
                block.chunk_id = chunk_map[block.page_number]
                await self._repo.update_block(block, session)
    
    async def get_or_generate_chunk_summaries(
        self,
        document_id: str,
        up_to_page: int,
        session: AsyncSession
    ) -> List[Tuple[Chunk, str]]:
        """
        Get chunk summaries up to a given page, generating them if needed.
        Returns list of (chunk, summary) tuples.
        """
        if not self._llm:
            return []
        
        # Get all chunks up to the page
        chunks = await self._repo.get_chunks_up_to_page(document_id, up_to_page, session)
        
        # Identify unprocessed chunks
        unprocessed = [c for c in chunks if c.status == ChunkStatus.UNPROCESSED]
        
        if unprocessed:
            # Generate summaries for unprocessed chunks in parallel
            await self._generate_chunk_summaries_parallel(unprocessed, session)
            
            # Refresh chunks to get updated summaries
            chunks = await self._repo.get_chunks_up_to_page(document_id, up_to_page, session)
        
        # Return chunks with their summaries
        return [(chunk, chunk.summary or "") for chunk in chunks]
    
    async def _generate_chunk_summaries_parallel(
        self,
        chunks: List[Chunk],
        session: AsyncSession
    ) -> None:
        """Generate summaries for multiple chunks (sequentially to avoid session conflicts)"""
        # TODO: Optimize with parallel execution using separate sessions
        for chunk in chunks:
            await self._generate_chunk_summary(chunk, session)
    
    async def _generate_chunk_summary(
        self,
        chunk: Chunk,
        session: AsyncSession
    ) -> None:
        """Generate summary for a single chunk"""
        try:
            # Mark chunk as processing
            chunk.set_processing()
            await self._repo.update_chunk(chunk, session)
            
            # Get document info
            document = await self._repo.get_document(chunk.document_id, session)
            if not document:
                raise ValueError(f"Document {chunk.document_id} not found")
            
            # Get all blocks for this chunk's pages
            all_blocks = await self._repo.get_blocks_by_document(chunk.document_id, session)
            chunk_blocks = [
                b for b in all_blocks 
                if b.page_number is not None and chunk.contains_page(b.page_number)
            ]
            
            # Sort blocks by page number
            chunk_blocks.sort(key=lambda b: (b.page_number or 0, b.id))
            
            # Extract text from blocks
            chunk_text = self._extract_text_from_blocks(chunk_blocks)
            
            # Generate summary using LLM
            summary = await self._generate_summary_with_llm(
                document_info=document.document_info,
                document_title=document.title,
                chunk_text=chunk_text,
                start_page=chunk.start_page,
                end_page=chunk.end_page,
                chunk_index=chunk.chunk_index
            )
            
            # Update chunk with summary
            chunk.set_ready(summary)
            await self._repo.update_chunk(chunk, session)
            
        except Exception as e:
            # Mark chunk as errored
            chunk.set_error(str(e))
            await self._repo.update_chunk(chunk, session)
            print(f"[ChunkService] Error generating summary for chunk {chunk.id}: {e}")
    
    def _extract_text_from_blocks(self, blocks: List[Block]) -> str:
        """Extract and clean text from blocks"""
        text_parts = []
        
        for block in blocks:
            if block.html_content:
                # Strip HTML tags
                clean_text = re.sub(r'<[^>]+>', ' ', block.html_content)
                # Clean up whitespace
                clean_text = ' '.join(clean_text.split())
                if clean_text.strip():
                    text_parts.append(clean_text)
        
        return "\n\n".join(text_parts)
    
    async def _generate_summary_with_llm(
        self,
        document_info: Optional[str],
        document_title: str,
        chunk_text: str,
        start_page: int,
        end_page: int,
        chunk_index: int
    ) -> str:
        """Generate chunk summary using LLM"""
        
        # Build system prompt
        system_prompt = f"""You are an expert at summarizing document sections.
You are looking at chunk {chunk_index + 1} (pages {start_page}-{end_page - 1}) of the document: "{document_title}"
{f'Document context: {document_info}' if document_info else ''}

Your task is to create a concise summary that captures:
1. Key points and arguments in this section
2. Important concepts, terms, or entities introduced
3. How this section relates to the document's overall purpose
4. Any transitions or connections to other parts

Keep the summary focused and informative, around 3-5 sentences."""

        # Build user prompt
        user_prompt = f"""Please summarize pages {start_page}-{end_page - 1} of the document.

Text from this section:
{chunk_text[:8000]}  # Limit to avoid token limits

Provide a clear, concise summary of this section."""

        # Create messages for LLM
        messages = [
            Message(
                id="sys",
                conversation_id="chunk_summary",
                parent_id=None,
                role=Role.SYSTEM,
                content=system_prompt,
                user_id="system",
                version=0
            ),
            Message(
                id="usr",
                conversation_id="chunk_summary",
                parent_id="sys",
                role=Role.USER,
                content=user_prompt,
                user_id="system",
                version=0
            )
        ]
        
        # Generate summary using GPT-4o-mini
        summary = await self._llm.generate_response(messages, model="gpt-4o-mini")
        
        return summary
    
    async def get_chunk_for_page(
        self,
        document_id: str,
        page_number: int,
        session: AsyncSession
    ) -> Optional[Chunk]:
        """Get the chunk that contains a specific page"""
        chunks = await self._repo.get_chunks_by_document(document_id, session)
        
        for chunk in chunks:
            if chunk.contains_page(page_number):
                return chunk
        
        return None