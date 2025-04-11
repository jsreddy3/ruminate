from typing import Dict, Any, Tuple, List
import requests
import asyncio
import os
import logging
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException
from src.models.viewer.block import Block, BlockType
from src.models.viewer.page import Page
from src.models.base.document import Document

# Set up logger
logger = logging.getLogger(__name__)

class MarkerService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.marker_url = "https://www.datalab.to/api/v1/marker"
        self.max_polls = 300  # 10 minutes
        self.poll_interval = 2  # seconds
        
        if not self.api_key:
            raise ValueError("API key not provided")

    async def process_document(self, file_data: bytes, document_id: str) -> Tuple[List[Page], List[Block]]:
        """Full document processing through Marker"""
        try:
            logger.info(f"Starting document processing for document_id: {document_id}")
            check_url = await self._initiate_processing(file_data)
            marker_response = await self._poll_until_complete(check_url)
            pages, blocks = self._create_pages_and_blocks(marker_response, document_id)
            logger.info(f"Document processing complete. Created {len(pages)} pages and {len(blocks)} blocks")
            return pages, blocks
            
        except Exception as e:
            logger.error(f"Error processing document: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def _initiate_processing(self, file_data: bytes) -> str:
        """Start Marker processing, return check_url"""
        form_data = {
            'file': ('document.pdf', file_data, 'application/pdf'),
            'langs': (None, "English"),
            'output_format': (None, 'json'),
            "paginate": (None, True),
            "force_ocr": (None, False),
            "use_llm": (None, False),
            "strip_existing_ocr": (None, False),
            "disable_image_extraction": (None, False)
        }
        
        headers = {"X-Api-Key": self.api_key}
        logger.info("Initiating document processing with Marker API")
        response = requests.post(self.marker_url, files=form_data, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Marker API request failed with status {response.status_code}: {response.text}")
            raise HTTPException(status_code=response.status_code, 
                              detail=f"Marker API request failed: {response.text}")
        
        data = response.json()
        if not data.get('success'):
            logger.error(f"Marker API request failed: {data.get('error')}")
            raise HTTPException(status_code=400, 
                              detail=f"Marker API request failed: {data.get('error')}")
            
        logger.info("Successfully initiated document processing")
        return data["request_check_url"]

    async def _poll_until_complete(self, check_url: str) -> Dict[str, Any]:
        """Poll check_url until processing is complete"""
        headers = {"X-Api-Key": self.api_key}
        
        logger.info(f"Beginning polling of check_url: {check_url}")
        for attempt in range(self.max_polls):
            await asyncio.sleep(self.poll_interval)
            response = requests.get(check_url, headers=headers)
            data = response.json()
            
            if data["status"] == "complete":
                if not data["success"]:
                    logger.error(f"Processing failed: {data.get('error')}")
                    raise HTTPException(status_code=400, 
                                      detail=f"Processing failed: {data.get('error')}")
                logger.info(f"Processing complete after {attempt + 1} attempts")
                return data.get('json', {})
                
        logger.error(f"Processing timed out after {self.max_polls} attempts")
        raise HTTPException(status_code=408, detail="Processing timeout")

    def _create_pages_and_blocks(self, marker_response: Dict[str, Any], document_id: str) -> Tuple[List[Page], List[Block]]:
        """Create Page and Block objects from Marker response"""
        pages = []
        blocks = []
        
        logger.info("Creating pages and blocks from Marker response")
        logger.debug(f"Response structure: {marker_response.keys()}")
        
        children = marker_response.get('children', [])
        logger.info(f"Found {len(children)} top-level children in response")
        
        # Process each page in the response
        for page_number, page_data in enumerate(children):
            if page_data.get('block_type') != 'Page':  # Only process Page blocks
                logger.warning(f"Skipping non-Page block at top level: {page_data.get('block_type')}")
                continue
                
            # Create the page
            page = Page(
                page_number=page_number,  # Sequential page number (0-based)
                polygon=page_data.get('polygon'),
                html_content=page_data.get('html', ""),
                document_id=document_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            pages.append(page)
            
            logger.info(f"Created page {page_number} with ID: {page.id}")
            
            # Process blocks in this page
            page_blocks = self._process_blocks(page_data.get('children', []), document_id, page.id, page_number)
            blocks.extend(page_blocks)
            
            logger.info(f"Processed {len(page_blocks)} blocks for page {page_number}")
            
            # Add block IDs to page
            for block in page_blocks:
                page.add_block(block.id)
        
        return pages, blocks
    
    def _process_blocks(self, block_list: List[Dict], document_id: str, page_id: str, page_number: int = None) -> List[Block]:
        """Recursively process blocks and their children"""
        blocks = []
        logger.debug(f"Processing {len(block_list)} blocks for page {page_number}, page_id: {page_id}")
        
        for block_data in block_list:
            # Create block with document_id and page_number passed directly to constructor
            block = Block.from_marker_block(
                marker_block=block_data, 
                document_id=document_id, 
                page_id=page_id,
                page_number=page_number
            )
            
            logger.debug(f"Created block type: {block.block_type}, page: {block.page_number}, id: {block.id}")
            blocks.append(block)
            
            # Process children recursively
            if block_data.get('children'):
                child_blocks = self._process_blocks(block_data['children'], document_id, page_id, page_number)
                blocks.extend(child_blocks)
        
        return blocks