"""Marker API client for document processing"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import aiohttp
from new_backend_ruminate.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MarkerResponse:
    """Response from Marker API"""
    status: str
    job_id: Optional[str] = None
    check_url: Optional[str] = None
    pages: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


class MarkerClient:
    """Client for interacting with Marker API for document processing"""
    
    def __init__(self):
        self.base_url = settings().marker_api_url
        self.api_key = settings().marker_api_key
        self.max_poll_attempts = settings().marker_max_poll_attempts
        self.poll_interval = settings().marker_poll_interval
    
    async def process_document(self, file_content: bytes, filename: str) -> MarkerResponse:
        """
        Submit a document to Marker API for processing and poll until complete
        
        Args:
            file_content: PDF file content as bytes
            filename: Name of the file
            
        Returns:
            MarkerResponse with processed document data
        """
        # Submit document for processing
        submit_response = await self._submit_document(file_content, filename)
        
        if submit_response.status == "error":
            return submit_response
        
        # Poll for completion
        if submit_response.check_url:
            return await self._poll_for_completion(submit_response.check_url)
        
        return submit_response
    
    async def _submit_document(self, file_content: bytes, filename: str) -> MarkerResponse:
        """Submit document to Marker API"""
        async with aiohttp.ClientSession() as session:
            headers = {}
            if self.api_key:
                headers["X-Api-Key"] = self.api_key
            
            # Prepare multipart form data
            data = aiohttp.FormData()
            data.add_field('file', file_content, filename=filename, content_type='application/pdf')
            data.add_field('langs', 'English')
            data.add_field('output_format', 'json')
            data.add_field('paginate', 'true')
            data.add_field('force_ocr', 'false')
            data.add_field('use_llm', 'true')
            data.add_field('strip_existing_ocr', 'false')
            data.add_field('disable_image_extraction', 'false')
            
            logger.info(f"Submitting document to Marker API: {self.base_url}")
            logger.debug(f"Headers: {headers}")
            
            try:
                async with session.post(
                    self.base_url,
                    data=data,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Marker API response status: {response.status}")
                    logger.debug(f"Response text: {response_text}")
                    
                    try:
                        result = json.loads(response_text)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse JSON response: {response_text}")
                        return MarkerResponse(
                            status="error",
                            error=f"Invalid JSON response: {response_text}"
                        )
                    
                    if response.status == 200:
                        # Check for success field
                        if not result.get('success', False):
                            error_msg = result.get('error', 'Marker API request failed')
                            logger.error(f"Marker API request failed: {error_msg}")
                            return MarkerResponse(
                                status="error",
                                error=error_msg
                            )
                        
                        # Handle different possible response formats
                        job_id = result.get("job_id") or result.get("request_id")
                        check_url = result.get("check_url") or result.get("request_check_url")
                        logger.info(f"Document submitted successfully. Job ID: {job_id}, Check URL: {check_url}")
                        return MarkerResponse(
                            status="processing",
                            job_id=job_id,
                            check_url=check_url
                        )
                    else:
                        error_msg = result.get("error", f"HTTP {response.status}")
                        logger.error(f"Marker API error: {error_msg}")
                        return MarkerResponse(
                            status="error",
                            error=error_msg
                        )
                        
            except Exception as e:
                logger.error(f"Error submitting to Marker API: {e}")
                return MarkerResponse(
                    status="error",
                    error=str(e)
                )
    
    async def _poll_for_completion(self, check_url: str) -> MarkerResponse:
        """Poll Marker API until processing is complete"""
        logger.info(f"Starting to poll Marker API at: {check_url}")
        async with aiohttp.ClientSession() as session:
            headers = {}
            if self.api_key:
                headers["X-Api-Key"] = self.api_key
            
            for attempt in range(self.max_poll_attempts):
                try:
                    logger.debug(f"Poll attempt {attempt + 1}/{self.max_poll_attempts}")
                    async with session.get(check_url, headers=headers) as response:
                        response_text = await response.text()
                        logger.debug(f"Poll response status: {response.status}")
                        logger.debug(f"Poll response text: {response_text[:500]}...")  # Truncate long responses
                        
                        # Handle rate limiting
                        if response.status == 429:
                            logger.warning("Rate limit hit. Waiting 30 seconds before retrying...")
                            await asyncio.sleep(30)
                            continue
                        
                        try:
                            result = json.loads(response_text)
                        except json.JSONDecodeError:
                            logger.error(f"Failed to parse JSON response: {response_text}")
                            await asyncio.sleep(self.poll_interval)
                            continue
                        
                        status = result.get("status", "unknown")
                        logger.info(f"Document processing status: {status}")
                        
                        if status in ["completed", "complete"]:
                            # Check for success
                            if not result.get("success", False):
                                error_msg = result.get('error', 'Processing failed')
                                logger.error(f"Processing failed: {error_msg}")
                                return MarkerResponse(
                                    status="error",
                                    error=error_msg
                                )
                            
                            # Get the JSON response data
                            json_data = result.get('json', {})
                            if not json_data:
                                logger.error("No JSON data in completed response")
                                return MarkerResponse(
                                    status="error",
                                    error="No JSON data in response"
                                )
                            
                            # Process the hierarchical structure
                            pages = self._process_marker_json(json_data)
                            
                            logger.info(f"Processing completed! Got {len(pages)} pages")
                            return MarkerResponse(
                                status="completed",
                                pages=pages
                            )
                        elif status == "failed":
                            error_msg = result.get("error", "Processing failed")
                            logger.error(f"Processing failed: {error_msg}")
                            return MarkerResponse(
                                status="error",
                                error=error_msg
                            )
                        elif status in ["processing", "pending"]:
                            # Continue polling
                            logger.debug(f"Still processing, waiting {self.poll_interval}s before next poll")
                            await asyncio.sleep(self.poll_interval)
                        else:
                            logger.warning(f"Unknown Marker status: {status}")
                            await asyncio.sleep(self.poll_interval)
                            
                except Exception as e:
                    logger.error(f"Error polling Marker API: {e}")
                    # Continue polling on transient errors
                    await asyncio.sleep(self.poll_interval)
            
            return MarkerResponse(
                status="error",
                error="Processing timeout - exceeded maximum poll attempts"
            )
    
    def _process_marker_json(self, json_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Process the hierarchical JSON structure from Marker API
        Converts from old format to simplified format expected by upload service
        """
        pages = []
        
        # Get top-level children which should be Page blocks
        children = json_data.get('children', [])
        logger.debug(f"Processing {len(children)} top-level children from Marker response")
        
        for page_number, page_data in enumerate(children):
            # Skip non-Page blocks at top level
            if page_data.get('block_type') != 'Page':
                logger.warning(f"Skipping non-Page block at top level: {page_data.get('block_type')}")
                continue
            
            # Extract page information
            page = {
                "page_number": page_number + 1,  # 1-based numbering for display
                "polygon": page_data.get('polygon'),
                "html": page_data.get('html', ""),
                "blocks": []
            }
            
            # Process blocks within this page
            page_blocks = self._extract_blocks(page_data.get('children', []))
            page["blocks"] = page_blocks
            
            pages.append(page)
            logger.debug(f"Processed page {page_number + 1} with {len(page_blocks)} blocks")
        
        return pages
    
    def _extract_blocks(self, block_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Recursively extract blocks from hierarchical structure
        """
        blocks = []
        
        for block_data in block_list:
            # Create simplified block structure
            block = {
                "block_type": block_data.get('block_type'),
                "html": block_data.get('html'),
                "polygon": block_data.get('polygon'),
                "section_hierarchy": block_data.get('section_hierarchy'),
                "metadata": block_data.get('metadata'),
                "images": block_data.get('images')
            }
            blocks.append(block)
            
            # Process children recursively
            if block_data.get('children'):
                child_blocks = self._extract_blocks(block_data['children'])
                blocks.extend(child_blocks)
        
        return blocks