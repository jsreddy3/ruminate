import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import asyncio
import json

from src.services.rumination.structured_insight_service import StructuredInsightService
from src.api.dependencies import get_insight_service, get_document_repository
from src.models.rumination.structured_insight import StructuredInsight, Annotation
from src.repositories.interfaces.document_repository import DocumentRepository
from src.models.viewer.block import Block, BlockType
from src.models.base.document import Document

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG level for detailed logging

router = APIRouter(prefix="/insights", tags=["insights"])

class AnalyzeBlockRequest(BaseModel):
    block_id: str
    page_number: int
    block_content: str
    document_id: str
    objective: str = Field(..., description="The objective for analyzing the block. Cannot be empty.")

class RuminateRequest(BaseModel):
    document_id: str
    objective: str = Field(..., description="The objective for analyzing the document. Cannot be empty.")

class RuminationStatus:
    PENDING = "pending"
    COMPLETE = "complete"
    ERROR = "error"

_rumination_status = {}  # Store status for each document
_current_block = {}  # Store current block being processed for each document
_rumination_objectives = {}  # Store objective for each document

async def rumination_event_generator(request: Request, insight_service: StructuredInsightService, document_id: str):
    """Generate SSE events for rumination progress"""
    try:
        while True:
            # Check if client closed connection
            if await request.is_disconnected():
                break

            # Get latest insights for the document
            insights = await insight_service.get_document_insights(document_id)
            
            # Get current status and block
            status = _rumination_status.get(document_id, RuminationStatus.PENDING)
            current_block_id = _current_block.get(document_id)
            objective = _rumination_objectives.get(document_id)
            
            # Send event with all necessary data
            yield f"data: {json.dumps({'insights': [insight.dict() for insight in insights],'status': status,'current_block_id': current_block_id,'objective': objective})}\n\n"
            
            if status in [RuminationStatus.COMPLETE, RuminationStatus.ERROR]:
                break
                
            await asyncio.sleep(1)
    except Exception as e:
        _rumination_status[document_id] = RuminationStatus.ERROR
        yield f"data: {json.dumps({'error': str(e),'status': RuminationStatus.ERROR,'current_block_id': None})}\n\n"

@router.get("/ruminate/stream/{document_id}")
async def stream_rumination(    
    request: Request,
    document_id: str,
    insight_service: StructuredInsightService = Depends(get_insight_service)
) -> StreamingResponse:
    """Stream rumination progress as Server-Sent Events"""
    return StreamingResponse(
        rumination_event_generator(request, insight_service, document_id),
        media_type="text/event-stream"
    )

@router.post("/ruminate")
async def start_rumination(
    request: RuminateRequest,
    insight_service: StructuredInsightService = Depends(get_insight_service),
    document_repository: DocumentRepository = Depends(get_document_repository)
) -> dict:
    """Start the rumination process for a document"""
    try:
        if not request.objective:
            raise HTTPException(status_code=400, detail="Objective is required")
            
        logger.debug("=" * 80)
        logger.debug("Starting new rumination process")
        logger.debug(f"Document ID: {request.document_id}")
        logger.debug(f"Objective: {request.objective}")
        logger.debug("=" * 80)
        
        # Reset status and store objective for this document
        _rumination_status[request.document_id] = RuminationStatus.PENDING
        _rumination_objectives[request.document_id] = request.objective
        logger.debug(f"Reset rumination status to {RuminationStatus.PENDING}")
        logger.debug(f"Set objective for document: {request.objective}")
        
        # Get all blocks for the document
        blocks = await document_repository.get_blocks(request.document_id)
        if not blocks:
            logger.error(f"No blocks found for document {request.document_id}")
            raise HTTPException(status_code=404, detail="No blocks found for document")
            
        logger.debug(f"Found {len(blocks)} blocks to process")
        
        # Start async task to process blocks
        logger.debug("Starting async block processing task")
        asyncio.create_task(process_document_blocks(blocks, insight_service, request.document_id))
        
        return {"status": "started", "document_id": request.document_id}
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"Error in start_rumination:")
        logger.error(f"Document ID: {request.document_id}")
        logger.error(f"Error: {str(e)}")
        logger.error("=" * 80)
        _rumination_status[request.document_id] = RuminationStatus.ERROR
        raise HTTPException(status_code=500, detail=str(e))

async def process_document_blocks(blocks: List[Block], insight_service: StructuredInsightService, document_id: str):
    """Process all blocks in a document asynchronously"""
    try:
        logger.debug("=" * 80)
        logger.debug(f"Starting block processing for document {document_id}")
        logger.debug(f"Total blocks to process: {len(blocks)}")
        logger.debug("=" * 80)
        
        # Get the objective from the rumination status
        objective = _rumination_objectives.get(document_id)
        if not objective:
            logger.error(f"No objective found for document {document_id}")
            raise ValueError("Objective is required for document processing")
        
        logger.debug(f"Using objective for all blocks: {objective}")
        
        processed_count = 0
        skipped_count = 0
        
        # Clear any existing current block
        _current_block[document_id] = None
        
        for block in blocks:
            # logger.debug("for loop\n", f"block: {block}")
            if not block.is_critical:
                skipped_count += 1
                logger.info(f"Skipping non-critical block: {block.html_content}")
                continue

            if block.block_type: # and block.block_type.lower() == "picture": # "text":
                logger.debug("if statement\n")
                try:
                    logger.debug(f"Processing block {block.id}")
                    logger.debug(f"Block type: {block.block_type}")
                    logger.debug(f"Content preview: {block.html_content[:100] if block.html_content else 'No content'}...")
                    logger.debug(f"Using objective: {objective}")
                    
                    # Process the block first
                    await insight_service.analyze_block(block, objective) # Calls structured_insight_service analyze_blocks
                    
                    # Only after successful analysis, update the current block
                    _current_block[document_id] = block.id
                    
                    # Give frontend time to process the change
                    await asyncio.sleep(0.5)
                    
                    processed_count += 1
                    logger.debug(f"Successfully processed block {block.id}")
                    logger.debug(f"Progress: {processed_count}/{len(blocks)} blocks processed")
                except Exception as block_error:
                    logger.error(f"Error processing block {block.id}:")
                    logger.error(str(block_error))
                    continue
            else:
                skipped_count += 1
                logger.debug(f"Skipping non-text block {block.id} of type {block.block_type}")
        
        logger.debug("=" * 80)
        logger.debug(f"Completed processing for document {document_id}")
        logger.debug(f"Processed blocks: {processed_count}")
        logger.debug(f"Skipped blocks: {skipped_count}")
        logger.debug("=" * 80)
        
        # Clear current block and set status to complete
        _current_block[document_id] = None
        _rumination_status[document_id] = RuminationStatus.COMPLETE
        
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"Fatal error in process_document_blocks:")
        logger.error(f"Document ID: {document_id}")
        logger.error(str(e))
        logger.error("=" * 80)
        _rumination_status[document_id] = RuminationStatus.ERROR
        _current_block[document_id] = None

@router.get("/block/{block_id}", response_model=StructuredInsight)
async def get_block_insight(
    block_id: str,
    document_id: str,
    insight_service: StructuredInsightService = Depends(get_insight_service),
    document_repository: DocumentRepository = Depends(get_document_repository)
) -> StructuredInsight:
    """Get insights for a specific block"""
    print("\n" + "="*50)
    print(f"ENDPOINT: Received request for block {block_id}")
    print(f"ENDPOINT: Document ID: {document_id}")
    
    try:
        # Get the objective for this document
        objective = _rumination_objectives.get(document_id)
        print(f"ENDPOINT: Retrieved objective: {objective}")
        
        if not objective:
            print("ENDPOINT: No objective found!")
            raise HTTPException(status_code=400, detail="No objective found for document. Please set an objective first.")
            
        # Get the actual block from the repository
        print("ENDPOINT: Fetching block from repository...")
        block = await document_repository.get_block(block_id)
        if not block:
            print(f"ENDPOINT: Block {block_id} not found!")
            raise HTTPException(status_code=404, detail="Block not found")
        
        print(f"ENDPOINT: Block found. Type: {block.block_type}")
        print(f"ENDPOINT: Has images? {'Yes' if block.images else 'No'}")
            
        # Analyze the block with the document's objective
        print("ENDPOINT: Starting block analysis...")
        insight = await insight_service.analyze_block(block, objective)
        if not insight:
            print("ENDPOINT: No insight generated!")
            raise HTTPException(status_code=404, detail="No insight found for block")
        
        print("ENDPOINT: Successfully generated insight")
        return insight
        
    except Exception as e:
        print(f"ENDPOINT ERROR: {str(e)}")
        logger.error(f"Error getting block insight for {block_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/document/{document_id}", response_model=List[StructuredInsight])
async def get_document_insights(
    document_id: str,
    insight_service: StructuredInsightService = Depends(get_insight_service)
) -> List[StructuredInsight]:
    """Get all insights for a document"""
    try:
        insights = await insight_service.get_document_insights(document_id)
        logger.debug(f"Retrieved {len(insights)} insights for document {document_id}")
        return insights
    except Exception as e:
        logger.error(f"Error getting document insights for {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze", response_model=StructuredInsight) 
async def analyze_block(
    request: AnalyzeBlockRequest,
    insight_service: StructuredInsightService = Depends(get_insight_service)
) -> StructuredInsight:
    """Analyze a block to generate insights"""
    try:
        from src.models.viewer.block import Block
        
        logger.debug(f"Analyzing block with data: {json.dumps({'block_id': request.block_id,'document_id': request.document_id,'page_number': request.page_number})}")
        
        if not request.document_id:
            logger.error("document_id is missing from request")
            raise HTTPException(status_code=400, detail="document_id is required")
            
        if not request.objective:
            logger.error("objective is missing from request")
            raise HTTPException(status_code=400, detail="objective is required")
            
        block = Block(
            id=request.block_id,
            document_id=request.document_id,
            block_type="text",
            html_content=request.block_content,
            page_number=request.page_number
        )
        
        logger.debug(f"Created Block object with document_id: {block.document_id}")
        logger.debug(f"Using objective for analysis: {request.objective}")
        
        insight = await insight_service.analyze_block(block, request.objective)
        logger.debug(f"Generated insight with document_id: {getattr(insight, 'document_id', None)}")
        
        if not getattr(insight, 'document_id', None):
            logger.error("Generated insight is missing document_id")
            
        return insight
    except ValueError as e:
        logger.error(f"Validation error analyzing block {request.block_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error analyzing block {request.block_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) 