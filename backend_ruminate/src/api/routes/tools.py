from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from src.services.rumination.graph_service import GraphService
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.key_term_repository import KeyTermRepository
from src.services.ai.llm_service import LLMService
from src.api.dependencies import get_graph_service, get_document_repository

router = APIRouter(prefix="/tools")

# Models for the API responses
class ArgumentNode(BaseModel):
    chunk_sequence: int
    category: str
    label: str
    quote: str
    explanation: Optional[str] = None
    
class Argument(BaseModel):
    label: str
    summary: str
    stance: Optional[str] = None
    predicted_counters: Optional[List[str]] = None
    
class ArgumentWithNodes(Argument):
    nodes: List[ArgumentNode]
    
class CounterArgument(BaseModel):
    label: str
    summary: str
    annotations: List[ArgumentNode]
    
class ChunkContent(BaseModel):
    sequence_number: int
    text: str
    
class KeyTermReference(BaseModel):
    id: str
    chunk_sequence: int
    chunk_id: str
    label: str
    quote: str
    explanation: str
    
class CustomAnalysisRequest(BaseModel):
    """Request model for custom term analysis"""
    terms: Optional[List[str]] = None
    themes: Optional[List[str]] = None
    concepts: Optional[List[str]] = None
    legal_standards: Optional[List[str]] = None
    key_vocabulary: Optional[List[str]] = None

# Endpoints

@router.get("/documents/{document_id}/arguments")
async def get_document_arguments(document_id: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Retrieve the full list of overarching arguments from cached data ONLY - never regenerate.
    This is a pure data access tool rather than a computation endpoint.
    """
    try:
        # First, try to get arguments from the document itself
        document = await graph_service.document_repository.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # Convert document to dictionary for consistent access if it's a Pydantic model
        doc_dict = document.dict() if hasattr(document, 'dict') else document
        
        # Check if document has arguments stored directly
        document_arguments = doc_dict.get("arguments", [])
        
        if document_arguments:
            all_arguments = []
            argument_names = set()
            
            for arg in document_arguments:
                name = arg.get("name", "")
                if name and name not in argument_names:
                    argument_names.add(name)
                    all_arguments.append({
                        "name": name,
                        "explanation": arg.get("explanation", f"Argument: {name}")
                    })
                    
            if all_arguments:
                # Format and return the arguments
                formatted_args = []
                for arg in all_arguments:
                    # Convert argument name to standard label format
                    label = arg["name"].upper().replace(" ", "_")
                    
                    # Get potential counter arguments
                    counters = []
                    for other_arg in all_arguments:
                        if other_arg["name"] != arg["name"]:
                            counters.append(other_arg["name"].upper().replace(" ", "_"))
                    
                    formatted_args.append({
                        "label": label,
                        "summary": arg["explanation"],
                        "stance": "neutral",  # Default stance
                        "predicted_counters": counters[:2]  # Limit to 2 counters
                    })
                
                return {
                    "document_id": document_id,
                    "arguments": formatted_args
                }
        
        # If not found in document, check chunk indices
        chunk_indices = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
        
        if not chunk_indices:
            return {
                "document_id": document_id,
                "arguments": [],
                "message": "No cached arguments found for this document"
            }
        
        # Convert Pydantic models to dictionaries for consistent access
        chunk_indices = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunk_indices]
        
        # Extract arguments from the chunks
        all_arguments = []
        argument_names = set()
        
        # Try to get arguments from mapping data
        for chunk in chunk_indices:
            chunk_data = chunk.get("data", {})
            mappings = chunk_data.get("argument_mappings", [])
            
            for mapping in mappings:
                arg_name = mapping.get("argument", "")
                if arg_name and arg_name not in argument_names:
                    argument_names.add(arg_name)
                    all_arguments.append({
                        "name": arg_name,
                        "explanation": mapping.get("explanation", f"Argument related to {arg_name}")
                    })
        
        # Also check for direct arguments array in chunk data
        for chunk in chunk_indices:
            chunk_data = chunk.get("data", {})
            arguments_data = chunk_data.get("arguments", [])
            
            for arg in arguments_data:
                name = arg.get("name", "")
                if name and name not in argument_names:
                    argument_names.add(name)
                    all_arguments.append({
                        "name": name,
                        "explanation": arg.get("explanation", f"Argument: {name}")
                    })
        
        # If still no arguments found, check if any other fields might contain them
        if not all_arguments:
            for chunk in chunk_indices:
                # Look for any field that might contain argument data
                for field_name, field_data in chunk.items():
                    if isinstance(field_data, list) and field_data and isinstance(field_data[0], dict):
                        for item in field_data:
                            if 'name' in item and 'explanation' in item:
                                name = item.get("name", "")
                                if name and name not in argument_names:
                                    argument_names.add(name)
                                    all_arguments.append({
                                        "name": name,
                                        "explanation": item.get("explanation", f"Argument: {name}")
                                    })
        
        # If still no arguments found, return empty set rather than regenerating
        if not all_arguments:
            return {
                "document_id": document_id,
                "arguments": [],
                "message": "No cached arguments found for this document"
            }
        
        # Format the response
        formatted_args = []
        for arg in all_arguments:
            # Convert argument name to standard label format
            label = arg["name"].upper().replace(" ", "_")
            
            # Get potential counter arguments
            counters = []
            for other_arg in all_arguments:
                if other_arg["name"] != arg["name"]:
                    counters.append(other_arg["name"].upper().replace(" ", "_"))
            
            formatted_args.append({
                "label": label,
                "summary": arg["explanation"],
                "stance": "neutral",  # Default stance
                "predicted_counters": counters[:2]  # Limit to 2 counters
            })
        
        return {
            "document_id": document_id,
            "arguments": formatted_args
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve arguments: {str(e)}")

@router.get("/arguments/{document_id}/{argument_label}")
async def get_argument_nodes(document_id: str, argument_label: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Retrieve specific nodes annotated under an overarching argument.
    """
    try:
        # Get chunks with analysis directly from the repository
        chunks = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
        
        # Convert all chunks to dictionaries for consistent access
        chunks = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunks]
        
        # Normalize the argument label for comparison
        normalized_label = argument_label.lower()
        
        # Find nodes matching the argument label
        nodes = []
        
        for chunk in chunks:
            # Get the chunk sequence - check both the top level and data dictionary
            chunk_sequence = chunk.get("sequence", None)
            if chunk_sequence is None:
                # If not found at top level, try to get from data dictionary
                chunk_data = chunk.get("data", {})
                chunk_sequence = chunk_data.get("sequence", 0)
            
            # Get chunk data - simplified now that everything is a dictionary
            chunk_data = chunk.get("data", chunk)
            
            # Categories to check for argument nodes
            categories = [
                'contested_definitions', 
                'argumentative_moves', 
                'counter_responses', 
                'core_principles', 
                'identity_claims', 
                'institutional_functions'
            ]
            
            # Look for matching nodes in each category
            for category in categories:
                elements = chunk_data.get(category, [])
                
                for element in elements:
                    # Check if element belongs to the requested argument in multiple ways
                    arg_id = element.get("argument_id", "").lower()
                    
                    # Check several variations of the argument ID
                    # 1. Exact match
                    # 2. Substring match
                    # 3. Match after removing underscores
                    # 4. Match with potential mapping from label to ID
                    if (normalized_label == arg_id or 
                        normalized_label in arg_id or
                        normalized_label.replace("_", "") in arg_id.replace("_", "") or
                        arg_id in normalized_label):
                        nodes.append({
                            "chunk_sequence": chunk_sequence,
                            "category": category.upper(),
                            "label": element.get("label", "Unnamed"),
                            "quote": element.get("quote", ""),
                            "explanation": element.get("explanation", "")
                        })
            
            # Check for authority references related to this argument
            references = chunk_data.get("authority_references", [])
            for ref in references:
                # For now, include all case references
                if ref.get("is_case", False) or ref.get("type", "") == "case":
                    nodes.append({
                        "chunk_sequence": chunk_sequence,
                        "category": "AUTHORITY_REFERENCES",
                        "label": ref.get("name", "Unnamed Case"),
                        "quote": ref.get("quote", ""),
                        "explanation": ref.get("explanation", "Case reference")
                    })
        
        # Get the actual argument name from cached data only - NEVER regenerate
        argument_name = ""
        
        # Try to get arguments from internal document repository
        document = await graph_service.document_repository.get_document(document_id)
        
        # Get arguments either from document or from saved chunk indices
        document_arguments = []
        
        if document:
            # Convert document to dictionary for consistent access if needed
            doc_dict = document.dict() if hasattr(document, 'dict') else document
            # Check if document has arguments
            document_arguments = doc_dict.get("arguments", [])
        
        # If no arguments in document, try to get from chunk indices
        if not document_arguments:
            # Get cached arguments from chunk indices
            chunk_indices = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
            
            # Convert to dictionaries for consistent access
            chunk_indices = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunk_indices]
            
            # Look for argument mappings in chunks
            for chunk in chunk_indices:
                chunk_data = chunk.get("data", {})
                mappings = chunk_data.get("argument_mappings", [])
                
                for mapping in mappings:
                    arg_name = mapping.get("argument", "")
                    if arg_name and arg_name not in [a.get("name", "") for a in document_arguments]:
                        document_arguments.append({
                            "name": arg_name,
                            "explanation": mapping.get("explanation", f"Argument related to {arg_name}")
                        })
        
        # Try to find the requested argument
        for arg in document_arguments:
            arg_name = arg.get("name", "")
            if arg_name and arg_name.upper().replace(" ", "_") == argument_label:
                argument_name = arg_name
                break
        
        return {
            "document_id": document_id,
            "argument_label": argument_label,
            "argument_name": argument_name,
            "nodes": nodes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve argument nodes: {str(e)}")

@router.get("/arguments/{document_id}/{argument_label}/counters")
async def get_counter_arguments(document_id: str, argument_label: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Directly exposes potential counter-arguments to each overarching argument.
    Uses only cached data - NEVER regenerates arguments.
    """
    try:
        # Get arguments from cached sources only - NEVER regenerate
        # First try document repository
        document = await graph_service.document_repository.get_document(document_id)
        
        # Get arguments either from document or from saved chunk indices
        document_arguments = []
        
        if document:
            # Convert document to dictionary for consistent access if needed
            doc_dict = document.dict() if hasattr(document, 'dict') else document
            # Check if document has arguments
            document_arguments = doc_dict.get("arguments", [])
        
        # If no arguments in document, try to get from chunk indices
        if not document_arguments:
            # Get cached arguments from chunk indices
            chunk_indices = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
            
            # Convert to dictionaries for consistent access
            chunk_indices = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunk_indices]
            
            # Look for argument mappings in chunks
            for chunk in chunk_indices:
                chunk_data = chunk.get("data", {})
                mappings = chunk_data.get("argument_mappings", [])
                
                for mapping in mappings:
                    arg_name = mapping.get("argument", "")
                    if arg_name and arg_name not in [a.get("name", "") for a in document_arguments]:
                        document_arguments.append({
                            "name": arg_name,
                            "explanation": mapping.get("explanation", f"Argument related to {arg_name}")
                        })
        
        # Find the target argument
        target_arg = None
        for arg in document_arguments:
            if arg.get("name", "").upper().replace(" ", "_") == argument_label:
                target_arg = arg
                break
        
        if not target_arg:
            raise HTTPException(status_code=404, detail=f"Argument {argument_label} not found")
        
        # For each other argument, consider it a potential counter - ONLY from cached data
        counter_arguments = []
        for arg in document_arguments:
            if arg.get("name") != target_arg.get("name"):
                # Create counter data without regenerating anything
                counter_label = arg.get("name", "").upper().replace(" ", "_")
                
                # Get nodes for this counter argument from chunk indices without regeneration
                counter_nodes = []
                for chunk in chunk_indices if 'chunk_indices' in locals() else []:
                    chunk_data = chunk.get("data", {})
                    mappings = chunk_data.get("argument_mappings", [])
                    
                    for mapping in mappings:
                        if mapping.get("argument") == arg.get("name"):
                            counter_nodes.append({
                                "quote": mapping.get("quote", ""),
                                "explanation": mapping.get("explanation", ""),
                                "chunk_id": chunk.get("chunk_id", "")
                            })
                
                counter_arguments.append({
                    "label": counter_label,
                    "summary": arg.get("explanation", ""),
                    "annotations": counter_nodes
                })
        
        return {
            "document_id": document_id,
            "argument_label": argument_label,
            "counterarguments": counter_arguments
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve counter arguments: {str(e)}")

@router.get("/case-glossary/{document_id}")
async def get_case_glossary(document_id: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Retrieve a glossary of ALL authority references used in the document.
    This includes legal cases, scholarly articles, reports, statutes, and other authoritative sources.
    """
    try:
        # Get chunks with analysis to extract cases
        chunks = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
        
        if not chunks:
            return {
                "document_id": document_id,
                "case_references": {},
                "message": "No analyzed chunks found for this document"
            }
        
        # Convert all chunks to dictionaries for consistent access
        chunks = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunks]
        
        # Extract all authority references
        authority_references = {}
        # print(f"DEBUG - get_case_glossary - Processing {len(chunks)} chunks for document {document_id}")
        
        for i, chunk in enumerate(chunks):
            # print(f"\nDEBUG - Processing chunk #{i} - chunk ID: {chunk.get('chunk_id') or chunk.get('id')}")
            
            # First, try direct access to authority_references field
            if "authority_references" in chunk:
                references = chunk["authority_references"]
                # print(f"DEBUG - Found {len(references)} direct authority_references in chunk")
                
                for ref in references:
                    # Look for authority names in label or name fields
                    auth_name = ref.get("label", "") or ref.get("name", "")
                    # print(f"DEBUG - Processing reference with name/label: '{auth_name}'")
                    
                    if auth_name:  # Include all labeled references, not just cases
                        explanation = ref.get("explanation", "") or ref.get("quote", "Authority reference")
                        if auth_name not in authority_references:
                            authority_references[auth_name] = explanation
                            # print(f"DEBUG - Added authority: '{auth_name}'")
            
            # Then check in the data field if it exists
            chunk_data = chunk.get("data", {})
            if chunk_data and chunk_data != chunk:  # avoid duplicate processing
                # print(f"DEBUG - Checking data field in chunk {i}")
                
                if "authority_references" in chunk_data:
                    references = chunk_data["authority_references"]
                    # print(f"DEBUG - Found {len(references)} authority_references in chunk.data")
                    
                    for ref in references:
                        auth_name = ref.get("label", "") or ref.get("name", "")
                        # print(f"DEBUG - Processing data reference with name/label: '{auth_name}'")
                        
                        if auth_name:
                            explanation = ref.get("explanation", "") or ref.get("quote", "Authority reference")
                            if auth_name not in authority_references:
                                authority_references[auth_name] = explanation
                                # print(f"DEBUG - Added authority from data: '{auth_name}'")
                
                # Check for any other fields that might contain authority references
                for category in ["AUTHORITY_REFERENCES", "authority_references"]:
                    references = chunk_data.get(category, [])
                    # print(f"DEBUG - Found {len(references)} references in category '{category}' in chunk data")
                    
                    for ref in references:
                        auth_name = ref.get("label", "") or ref.get("name", "")
                        # print(f"DEBUG - Processing reference from '{category}' with name/label: '{auth_name}'")
                        
                        if auth_name:
                            explanation = ref.get("explanation", "") or ref.get("quote", "Authority reference")
                            if auth_name not in authority_references:
                                authority_references[auth_name] = explanation
                                # print(f"DEBUG - Added authority from '{category}': '{auth_name}'")
                
                # Check within other analysis categories in case references are nested
                categories = [
                    'contested_definitions', 
                    'argumentative_moves', 
                    'counter_responses', 
                    'core_principles', 
                    'identity_claims', 
                    'institutional_functions'
                ]
                
                # print(f"DEBUG - Checking nested categories in chunk {i}")
                for category in categories:
                    elements = chunk_data.get(category, [])
                    
                    for element in elements:
                        el_references = element.get("authority_references", [])

                        for ref in el_references:
                            auth_name = ref.get("label", "") or ref.get("name", "")
                            # print(f"DEBUG - Processing nested reference from '{category}' with name/label: '{auth_name}'")
                            
                            if auth_name:
                                explanation = ref.get("explanation", "") or ref.get("quote", "Authority reference")
                                if auth_name not in authority_references:
                                    authority_references[auth_name] = explanation
                                    # print(f"DEBUG - Added nested authority from '{category}': '{auth_name}'")
            
            # Finally, search for any quotes that look like case citations or authority references in all fields
            # print(f"DEBUG - Scanning all fields in chunk {i} for authority references")
            field_search_auth_found = 0
            
            for field_name, field_value in chunk.items():
                if isinstance(field_value, list):
                    for item in field_value:
                        if isinstance(item, dict):
                            for key, value in item.items():
                                if key in ["label", "name"] and isinstance(value, str) and value:
                                    # print(f"DEBUG - Found potential authority name field '{key}' with value: '{value}'")
                                    explanation = item.get("explanation", "") or item.get("quote", "Authority reference")
                                    if value not in authority_references:
                                        authority_references[value] = explanation
                                        field_search_auth_found += 1
                                        # print(f"DEBUG - Added authority from general search: '{value}'")
            
            # print(f"DEBUG - Found {field_search_auth_found} additional authorities from field scanning in chunk {i}")
        
        # Debug: Add message if no authority references found
        if not authority_references:
            return {
                "document_id": document_id,
                "authority_references": {},
                "message": "No authority references found in document analysis"
            }
        
        # Rename for output for backward compatibility
        return {
            "document_id": document_id,
            "case_references": authority_references,  # Keep the key as case_references for compatibility
            "message": f"Found {len(authority_references)} authority references in document"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve case glossary: {str(e)}")

@router.get("/chunks/{document_id}/{sequence_number}")
async def get_chunk_content(document_id: str, sequence_number: int, doc_repo: DocumentRepository = Depends(get_document_repository)):
    """
    Retrieve the content of a specific chunk.
    """
    try:
        # Use the injected document repository
        
        # Get the document chunks
        chunks = await doc_repo.get_chunks(document_id)
        
        if not chunks:
            raise HTTPException(status_code=404, detail=f"No chunks found for document {document_id}")
        
        # Convert chunks to dictionaries for consistent access if needed
        chunks = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunks]
        
        # Find the requested chunk
        target_chunk = None
        for chunk in chunks:
            # Try different ways to access the sequence property
            chunk_sequence = None
            if hasattr(chunk, 'sequence'):
                chunk_sequence = chunk.sequence
            elif 'sequence' in chunk:
                chunk_sequence = chunk['sequence']
            elif hasattr(chunk, 'get') and callable(chunk.get):
                chunk_sequence = chunk.get('sequence')
            
            if chunk_sequence == sequence_number:
                target_chunk = chunk
                break
        
        if not target_chunk:
            raise HTTPException(status_code=404, detail=f"Chunk with sequence {sequence_number} not found")
        
        # Try different ways to access the content
        chunk_content = ""
        
        # Check for html_content in different ways
        if hasattr(target_chunk, 'html_content'):
            chunk_content = target_chunk.html_content
        elif 'html_content' in target_chunk:
            chunk_content = target_chunk['html_content']
        elif hasattr(target_chunk, 'get') and callable(target_chunk.get):
            chunk_content = target_chunk.get('html_content', '')
        
        # If still no content, try text content
        if not chunk_content and hasattr(target_chunk, 'text'):
            chunk_content = target_chunk.text
        elif not chunk_content and 'text' in target_chunk:
            chunk_content = target_chunk['text']
        elif not chunk_content and hasattr(target_chunk, 'get') and callable(target_chunk.get):
            chunk_content = target_chunk.get('text', '')
        
        # If still no content, try content field
        if not chunk_content and hasattr(target_chunk, 'content'):
            chunk_content = target_chunk.content
        elif not chunk_content and 'content' in target_chunk:
            chunk_content = target_chunk['content']
        elif not chunk_content and hasattr(target_chunk, 'get') and callable(target_chunk.get):
            chunk_content = target_chunk.get('content', '')
            
        return {
            "sequence_number": sequence_number,
            "text": chunk_content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chunk content: {str(e)}")

@router.get("/arguments/{document_id}/{argument_label}/categories/{category}")
async def get_argument_category(document_id: str, argument_label: str, category: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Retrieve specific category data for an argument (e.g., supporting cases, key concepts).
    """
    try:
        # Normalize category name
        normalized_category = category.lower()
        
        # Get argument nodes
        argument_data = await get_argument_nodes(document_id, argument_label, graph_service)
        
        # Filter nodes by the requested category
        category_nodes = []
        for node in argument_data["nodes"]:
            if node["category"].lower() == normalized_category:
                category_nodes.append(node)
        
        return {
            "document_id": document_id,
            "argument_label": argument_label,
            "argument_name": argument_data["argument_name"],
            "category": category.upper(),
            "nodes": category_nodes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve argument category data: {str(e)}")

@router.get("/arguments/{document_id}/{argument_label}/cases")
async def get_argument_cases(document_id: str, argument_label: str):
    """
    Retrieve cases supporting a specific argument.
    """
    return await get_argument_category(document_id, argument_label, "authority_references")

@router.get("/arguments/{document_id}/{argument_label}/concepts")
async def get_argument_concepts(document_id: str, argument_label: str):
    """
    Retrieve key concepts for a specific argument.
    """
    return await get_argument_category(document_id, argument_label, "core_principles")

@router.get("/documents/{document_id}/key-terms")
async def get_document_key_terms(document_id: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Retrieve all key terms for a document from cached data ONLY - never regenerate.
    This is a pure data access tool rather than a computation endpoint.
    
    Args:
        document_id: ID of the document to retrieve key terms for
        
    Returns:
        List of unique key terms in the document
    """
    try:
        # Check if document exists
        document = await graph_service.document_repository.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # Get all key terms from the repository
        terms = await graph_service.key_term_repository.get_all_terms(document_id)
        
        if not terms:
            # No key terms found for document
            return []
            
        return terms
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving key terms: {str(e)}")

@router.get("/documents/{document_id}/key-terms/{term}", response_model=List[KeyTermReference])
async def get_key_term_references(document_id: str, term: str, graph_service: GraphService = Depends(get_graph_service)):
    # Import the normalize_term function from GraphService
    from src.services.rumination.graph_service import normalize_term
    """
    Retrieve all references to a specific key term in a document.
    Uses only cached data - NEVER regenerates key terms.
    
    Args:
        document_id: ID of the document to retrieve key term references for
        term: The specific key term to get references for
        
    Returns:
        List of key term references with quotes, explanations, and metadata
    """
    try:
        # Check if document exists
        document = await graph_service.document_repository.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # Normalize the term by replacing spaces with underscores for consistent lookup
        normalized_term = normalize_term(term)
        
        # Get all notes for this term using the normalized format
        notes = await graph_service.key_term_repository.get_notes_by_term(document_id, normalized_term)
        
        if not notes:
            # No references found for this term
            return []
            
        # Convert to a consistent response format
        references = []
        for note in notes:
            references.append({
                "id": note.id,
                "chunk_sequence": note.chunk_sequence,
                "chunk_id": note.chunk_id,
                "label": note.label,
                "quote": note.quote,
                "explanation": note.explanation
            })
            
        # Sort by chunk sequence for consistent ordering
        references.sort(key=lambda x: x["chunk_sequence"])
        
        return references
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving key term references: {str(e)}")

@router.get("/documents/{document_id}/content")
async def get_document_content(document_id: str, doc_repo: DocumentRepository = Depends(get_document_repository)):
    """
    Retrieve the full content of a document by combining all its chunks.
    
    Args:
        document_id: ID of the document to retrieve
        
    Returns:
        The complete document content with metadata
    """
    try:
        # Get document metadata
        document = await doc_repo.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # Get all chunks for this document
        chunks = await doc_repo.get_chunks(document_id)
        if not chunks:
            raise HTTPException(status_code=404, detail=f"No chunks found for document {document_id}")
        
        # Sort chunks by sequence number and convert to consistent format
        # Use the get() method we just added to our Chunk class
        sorted_chunks = sorted(chunks, key=lambda x: x.get('sequence', 0) if hasattr(x, 'get') else getattr(x, 'sequence', 0))
        
        # Combine chunk contents
        combined_text = ""
        combined_html = ""
        
        for chunk in sorted_chunks:
            # Handle both dictionary and object access consistently
            text = chunk.get('text', '') if hasattr(chunk, 'get') else ''
            html_content = chunk.get('html_content', '') if hasattr(chunk, 'get') else getattr(chunk, 'html_content', '')
            
            if text:
                combined_text += text + "\n\n"
            if html_content:
                combined_html += html_content + "\n"
        
        return {
            "document_id": document_id,
            "title": document.get('title', 'Untitled Document'),
            "metadata": {
                "created_at": document.get('created_at', ''),
                "updated_at": document.get('updated_at', ''),
                "source": document.get('source', ''),
                "doc_type": document.get('doc_type', ''),
                "chunk_count": len(chunks)
            },
            "text_content": combined_text,
            "html_content": combined_html
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve document content: {str(e)}")


@router.get("/debug/chunk-indices/{document_id}")
async def debug_chunk_indices(document_id: str, graph_service: GraphService = Depends(get_graph_service)):
    """
    Debug endpoint to inspect the raw chunk indices for a document
    """
    try:
        # Get chunk indices directly from repository
        chunks = await graph_service.chunk_index_repository.get_document_chunk_indices(document_id)
        
        # Convert all chunks to dictionaries for consistent access
        chunks = [chunk.dict() if hasattr(chunk, 'dict') else chunk for chunk in chunks]
        
        # Structure the response to make it easier to analyze
        result = []
        for chunk in chunks:
            chunk_data = chunk
            
            # Handle nested data structure if present
            if "data" in chunk and isinstance(chunk["data"], dict):
                chunk_data = chunk["data"]
                
            # Create a simplified version focusing on what we need
            simple_chunk = {
                "id": chunk_data.get("id", ""),
                "chunk_id": chunk_data.get("chunk_id", ""),
                "sequence": chunk_data.get("sequence", 0),
                "summary": chunk_data.get("summary", "")
            }
            
            # Add element samples to check how argument IDs are stored
            categories = [
                'authority_references', 
                'contested_definitions', 
                'argumentative_moves', 
                'counter_responses', 
                'core_principles', 
                'identity_claims', 
                'institutional_functions'
            ]
            
            for category in categories:
                elements = chunk_data.get(category, [])
                simple_chunk[f"{category}_count"] = len(elements)
                
                # Show argument IDs for some elements as a sample
                if elements and len(elements) > 0:
                    sample_elements = elements[:3]  # Show up to 3 elements
                    simple_chunk[f"{category}_sample"] = [
                        {
                            "label": e.get("label", ""),
                            "argument_id": e.get("argument_id", ""),
                            "quote": e.get("quote", "")[:50] + "..." if len(e.get("quote", "")) > 50 else e.get("quote", "")
                        } for e in sample_elements
                    ]
            
            result.append(simple_chunk)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving chunk indices: {str(e)}")


@router.post("/documents/{document_id}/custom-analysis", response_model=List[Dict[str, Any]])
async def analyze_custom_terms(document_id: str, request: CustomAnalysisRequest, graph_service: GraphService = Depends(get_graph_service)):
    """
    Analyze a document for custom term categories and generate key term notes.
    
    This endpoint allows you to analyze a document for specific terms grouped by categories.
    If terms have been previously analyzed, it will return existing notes rather than regenerating them.
    
    Args:
        document_id: ID of the document to analyze
        request: The CustomAnalysisRequest containing category-based terms to analyze
            - terms: General terms to search for
            - themes: Thematic elements to identify
            - concepts: Legal or abstract concepts to identify
            - legal_standards: Legal standards or tests to identify
            - key_vocabulary: Important vocabulary terms to identify
    
    Returns:
        List of key term notes organized by chunk sequence, with quotes and explanations
    
    Example:
        POST /tools/documents/123/custom-analysis
        {
            "terms": ["distracted driving"],
            "themes": ["justice", "liberty"]
        }
    """
    try:
        # Check if document exists
        document = await graph_service.document_repository.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # Construct term categories dictionary from the request
        term_categories = {}
        
        if request.terms:
            term_categories["terms"] = request.terms
        if request.themes:
            term_categories["themes"] = request.themes
        if request.concepts:
            term_categories["concepts"] = request.concepts
        if request.legal_standards:
            term_categories["legal_standards"] = request.legal_standards
        if request.key_vocabulary:
            term_categories["key_vocabulary"] = request.key_vocabulary
        
        if not term_categories:
            raise HTTPException(status_code=400, detail="No terms provided for analysis")
        
        # Perform the custom analysis
        results = await graph_service.custom_analysis(document_id, term_categories)
        
        if not results:
            return []
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error performing custom analysis: {str(e)}")
