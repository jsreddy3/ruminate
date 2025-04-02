from src.models.viewer.block import Block
from src.services.ai.llm_service import LLMService
from src.models.conversation.message import Message, MessageRole
import re
import uuid
import logging
import asyncio
from typing import List, Dict

class CriticalContentService:
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.logger = logging.getLogger(__name__)

    async def _get_document_summary(self, blocks: List[Block]) -> str:
        """Generate a quick summary of a given document"""
        if not blocks:
            return ""
            
        block_content = []
        for block in blocks:
            block_text = block.html_content or ""
            block_content.append(re.sub(r'<[^>]+>', '', block_text).strip())
        summary = "\n".join(block_content)
        
        messages = [
            Message(
                role=MessageRole.SYSTEM,
                content="You are a document summarizer.",
                conversation_id=blocks[0].document_id
            ),
            Message(
                role=MessageRole.USER,
                content=f"Please provide a comprehensive summary of this document: {summary}",
                conversation_id=blocks[0].document_id
            )
        ]
        
        try:
            summary = await self.llm_service.generate_response(messages)
            self.logger.info("Generated document summary:", summary)
            return summary
        except Exception as e:
            self.logger.error(f"Error generating document summary: {e}")
            return ""

    async def _analyze_critical_blocks(self, blocks: List[Block], doc_summary: str, batch_size: int = 5):
        """Process blocks in batches to determine critical content"""
        self.logger.info(f"Starting critical content analysis for {len(blocks)} blocks")
        
        # Define the JSON schema for block analysis
        json_schema = {
            "type": "object",
            "properties": {
                "is_critical": {
                    "type": "boolean",
                    "description": "Whether this block contains critical information"
                },
                "summary": {
                    "type": "string",
                    "description": "Summary of the block if it is critical"
                }
            },
            "required": ["is_critical", "summary"]
        }
        
        for i in range(0, len(blocks), batch_size):
            batch = blocks[i:i + batch_size]
            self.logger.info(f"Processing batch {i//batch_size + 1} of {(len(blocks) + batch_size - 1)//batch_size}")
            
            tasks = []
            for block in batch:
                block_text = block.html_content or ""
                plain_text = re.sub(r'<[^>]+>', '', block_text).strip()
                
                messages = [
                    Message(
                        role=MessageRole.SYSTEM,
                        content="""You analyze document blocks to determine if they contain critical information. Exclude blocks like footnotes, irrelevant brand information, and other non-critical information.
                        
                        You must respond with a JSON object containing:
                        {
                            "is_critical": boolean,  // Whether this block contains critical information
                            "summary": string        // If the block is critical, fill out this field with a summary of the block
                        }""",
                        conversation_id=block.document_id
                    ),
                    Message(
                        role=MessageRole.USER,
                        content=f"""Document Context: {doc_summary}
                        
                        Analyze this block and respond with JSON:
                        {plain_text}""",
                        conversation_id=block.document_id
                    )
                ]

                tasks.append(self.llm_service.generate_structured_response(
                    messages=messages,
                    response_format={"type": "json_object"},
                    json_schema=json_schema
                ))
            
            try:
                results = await asyncio.gather(*tasks)
                
                # Update blocks with results
                for block, result in zip(batch, results):
                    block.is_critical = result["is_critical"]
                    block.critical_summary = result["summary"]
                    self.logger.info(f"Block {block.id} is critical: {block.is_critical} - {block.critical_summary}")    
            except Exception as e:
                self.logger.error(f"Error in batch processing: {e}")
                # Continue with next batch even if this one failed
                continue