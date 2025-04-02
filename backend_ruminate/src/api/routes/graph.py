from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Optional

from src.api.dependencies import get_graph_service, get_db
from src.services.rumination.graph_service import GraphService

graph_router = APIRouter(prefix="/graph")

@graph_router.get("/arguments/{document_id}")
async def get_document_arguments(
    document_id: str,
    graph_service: GraphService = Depends(get_graph_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, List[Dict[str, str]]]:
    """
    Identify primary overarching arguments and key themes/terms that structure a document's reasoning.
    
    Args:
        document_id: ID of the document to analyze
        
    Returns:
        Dictionary containing:
        - arguments: List of dictionaries with explanation and name for each overarching argument
        - key_themes_terms: List of dictionaries with theme_name and explanation for each key theme/term
    """
    # Verify document_id
    if not document_id:
        raise HTTPException(status_code=400, detail="Document ID is required")
        
    # Call graph service to identify arguments
    arguments, key_themes_terms = await graph_service.identify_document_arguments(document_id)
    
    if not arguments:
        raise HTTPException(status_code=404, detail="Could not identify arguments for document")
        
    return {"arguments": arguments, "key_themes_terms": key_themes_terms}

@graph_router.get("/key-terms/{document_id}")
async def get_document_key_terms(
    document_id: str,
    graph_service: GraphService = Depends(get_graph_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, List[Dict]]:
    """
    Retrieve all key terms and their associated notes for a document.
    
    Args:
        document_id: ID of the document to retrieve key terms for
        
    Returns:
        Dictionary with:
        - terms: List of unique terms in the document
        - notes: Dictionary mapping each term to a list of associated notes
    """
    # Verify document_id
    if not document_id:
        raise HTTPException(status_code=400, detail="Document ID is required")
        
    # Get all unique terms for the document
    terms = await graph_service.key_term_repository.get_all_terms(document_id)
    
    if not terms:
        raise HTTPException(status_code=404, detail="No key terms found for document")
    
    # Get notes for each term
    notes_by_term = {}
    for term in terms:
        term_notes = await graph_service.key_term_repository.get_notes_by_term(document_id, term)
        notes_by_term[term] = [
            {
                "id": note.id,
                "chunk_sequence": note.chunk_sequence,
                "label": note.label,
                "quote": note.quote,
                "explanation": note.explanation
            } for note in term_notes
        ]
    
    return {"terms": terms, "notes": notes_by_term}

@graph_router.post("/analyze-chunks/{document_id}")
async def analyze_document_chunks(
    document_id: str,
    graph_service: GraphService = Depends(get_graph_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, str]:
    """
    Analyze all chunks in a document to extract notes and map them to arguments.
    
    This endpoint processes each chunk sequentially to build a glossary of cases
    and extract various elements like argumentative moves, contested definitions, etc.
    Each element is mapped to a document argument.
    
    Args:
        document_id: ID of the document to analyze
        
    Returns:
        Status of the analysis operation
    """
    # Verify document_id
    if not document_id:
        raise HTTPException(status_code=400, detail="Document ID is required")
        
    # Call graph service to analyze document chunks
    chunk_indices = await graph_service.analyze_document_chunks(document_id)
    
    if not chunk_indices:
        raise HTTPException(status_code=404, detail="Could not analyze chunks for document or no chunks found")
        
    return {"status": "success", "message": f"Successfully analyzed {len(chunk_indices)} chunks for document {document_id}"}

@graph_router.get("/chunk-analysis/{document_id}")
async def get_document_chunk_analysis(
    document_id: str,
    graph_service: GraphService = Depends(get_graph_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Dict]:
    """
    Retrieve the analysis results for all chunks in a document.
    
    Args:
        document_id: ID of the document to retrieve chunk analysis for
        
    Returns:
        List of chunk analysis results
    """
    # Verify document_id
    if not document_id:
        raise HTTPException(status_code=400, detail="Document ID is required")
        
    # Get all chunk indices for the document
    chunk_indices = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
    
    if not chunk_indices:
        raise HTTPException(status_code=404, detail="No chunk analysis found for document")
        
    # Convert chunk indices to dicts for JSON response
    return [chunk_index.model_dump() for chunk_index in chunk_indices]
