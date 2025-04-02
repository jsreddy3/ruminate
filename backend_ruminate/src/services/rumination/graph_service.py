# services/rumination/graph_service.py
import json
import asyncio
import logging
import os
import sys
import subprocess
import re
from openai import OpenAI
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from src.models.base.chunk import Chunk
from src.models.conversation.message import Message, MessageRole
from src.services.ai.llm_service import LLMService
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.chunk_index_repository import ChunkIndexRepository
from src.repositories.interfaces.key_term_repository import KeyTermRepository
from src.models.rumination.chunk_index import ChunkIndex

logger = logging.getLogger(__name__)


def normalize_term(term: str) -> str:
    """Convert a term to a normalized format by replacing spaces with underscores.
    This makes terms more consistent for database storage and URL-friendly.
    
    Args:
        term: The term to normalize
        
    Returns:
        Normalized term with spaces replaced by underscores
    """
    return re.sub(r'\s+', '_', term.strip())

class GraphService:
    """Service for analyzing document chunks to extract graph elements for visualization."""
    
    def __init__(self, 
                 llm_service: LLMService, 
                 document_repository: DocumentRepository,
                 chunk_index_repository: ChunkIndexRepository,
                 key_term_repository):
        self.llm_service = llm_service
        self.document_repository = document_repository
        self.chunk_index_repository = chunk_index_repository
        self.key_term_repository = key_term_repository
        
        # Override the LLM service model to use GPT-4o
        self.llm_service.CHAT_MODEL = "gpt-4o"
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        
        # Case glossary to track case references across chunks
        self.case_glossaries = {}
        
    async def custom_analysis(self, document_id: str, term_categories: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """
        Analyze all chunks in a document based on custom term categories and save the results to the database.
        
        This method processes all chunks in parallel to identify and analyze
        instances of specified terms within each category. For example, you can
        analyze a document for specific key vocabulary terms, concepts, etc.
        
        Uses a filtering step to only process chunks that are likely to contain the terms,
        either directly or through semantic similarity based on embeddings.
        
        If terms have already been analyzed before, it will reuse the existing notes
        rather than regenerating them.
        
        Args:
            document_id: ID of the document to analyze
            term_categories: Dictionary mapping category names to lists of terms
                             For example: {"key vocabulary": ["marriage"], "concepts": ["equal protection"]}
            
        Returns:
            List of key term notes in chunk sequence order
        """
        try:
            # Check if document exists
            if not await self.document_exists(document_id):
                logger.error(f"Document {document_id} not found")
                return []
            
            # First check which terms already have existing notes
            from src.models.rumination.key_term_note import KeyTermNote
            
            # Collect all existing notes and track which terms are new
            existing_notes = []
            new_term_categories = {}
            
            for category, terms in term_categories.items():
                new_terms = []
                for term in terms:
                    # Normalize the term by replacing spaces with underscores
                    normalized_term = normalize_term(term)
                    
                    # Try to get existing notes for this term
                    term_notes = await self.key_term_repository.get_notes_by_term(document_id, normalized_term)
                    
                    if term_notes and len(term_notes) > 0:
                        # We already have notes for this term, add them to our collection
                        logger.info(f"Found {len(term_notes)} existing notes for term '{normalized_term}'")
                        
                        # Convert KeyTermNote objects to the expected dictionary format
                        for note in term_notes:
                            # Term is stored directly without category prefix
                            original_term = note.term
                            
                            existing_notes.append({
                                "category": category,
                                "term": original_term,
                                "chunk_sequence": note.chunk_sequence,
                                "chunk_id": note.chunk_id,
                                "label": note.label,
                                "quote": note.quote,
                                "explanation": note.explanation
                            })
                    else:
                        # No existing notes for this term, add it to new terms list
                        new_terms.append(term)
                
                # If we have new terms for this category, add them to our new terms dictionary
                if new_terms:
                    new_term_categories[category] = new_terms
            
            # If we don't have any new terms to process, return just the existing notes
            if not new_term_categories:
                logger.info("All requested terms already have existing notes, returning those")
                # Sort by chunk sequence for consistent ordering
                existing_notes.sort(key=lambda x: x['chunk_sequence'])
                return existing_notes
                
            # Get all chunks for the document for analysis of new terms
            chunks = await self.document_repository.get_chunks(document_id)
            
            # Sort chunks by sequence
            chunks.sort(key=lambda x: x.sequence)
            
            if not chunks:
                logger.warning(f"No chunks found for document {document_id}")
                # Return any existing notes we found earlier
                if existing_notes:
                    existing_notes.sort(key=lambda x: x['chunk_sequence'])
                    return existing_notes
                return []
            
            # Filter chunks to only those that contain the new terms
            logger.info(f"Filtering {len(chunks)} chunks for relevant terms from {sum(len(terms) for terms in new_term_categories.values())} new terms")
            filtered_chunks = []
            filtered_chunks_indices = []
            
            # Create filtering tasks for new terms only
            filter_tasks = [self._filter_chunks(chunk, new_term_categories) for chunk in chunks]
            filter_results = await asyncio.gather(*filter_tasks)
            
            # Collect chunks that passed the filter
            for i, result in enumerate(filter_results):
                if result:
                    filtered_chunks.append(chunks[i])
                    filtered_chunks_indices.append(i)
            
            logger.info(f"Filtered down from {len(chunks)} chunks to {len(filtered_chunks)} chunks containing new terms")
            
            if not filtered_chunks:
                logger.warning(f"No chunks found with the new terms for document {document_id}")
                # Return any existing notes we found earlier
                if existing_notes:
                    existing_notes.sort(key=lambda x: x['chunk_sequence'])
                    return existing_notes
                return []
            
            # Define a helper function to process a single chunk with new terms and save to database
            async def process_chunk_custom_terms(chunk):
                try:
                    # Get custom term notes analysis
                    notes = await self._analyze_chunk_with_custom_terms(chunk, new_term_categories)
                    
                    # Save each note to the database
                    saved_notes = []
                    for note_data in notes:
                        # Create a KeyTermNote with the term directly without prefixing with category
                        category = note_data.get("category", "").strip()
                        term = note_data["term"].strip()
                        
                        # Normalize the term by replacing spaces with underscores
                        normalized_term = normalize_term(term)
                        
                        note = KeyTermNote(
                            document_id=document_id,
                            chunk_id=chunk.id,
                            chunk_sequence=chunk.sequence,
                            term=normalized_term,  # Use the normalized term (spaces replaced with underscores)
                            label=note_data["label"],
                            quote=note_data["quote"],
                            explanation=note_data["explanation"],
                            created_at=datetime.now()
                        )
                        
                        # Save to database
                        await self.key_term_repository.create_key_term_note(note)
                        saved_notes.append(note_data)
                        
                    logger.info(f"Saved {len(saved_notes)} custom term notes for chunk {chunk.id}")
                    return saved_notes
                except Exception as e:
                    logger.error(f"Error processing chunk custom terms {chunk.id}: {str(e)}")
                    return []
            
            # Process filtered chunks in parallel
            logger.info(f"Starting parallel analysis of {len(filtered_chunks)} filtered chunks with new term categories")
            
            # Create tasks for filtered chunks
            tasks = [process_chunk_custom_terms(chunk) for chunk in filtered_chunks]
            
            # Run all tasks in parallel
            all_new_notes = await asyncio.gather(*tasks)
            
            # Flatten the list of new notes
            new_notes = []
            for filtered_idx, notes in enumerate(all_new_notes):
                chunk = filtered_chunks[filtered_idx]
                for note in notes:
                    note['chunk_sequence'] = chunk.sequence
                    note['chunk_id'] = chunk.id
                    new_notes.append(note)
            
            # Combine existing and new notes
            all_notes = existing_notes + new_notes
            
            # Sort by chunk sequence
            all_notes.sort(key=lambda x: x['chunk_sequence'])
            
            total_notes = len(all_notes)
            logger.info(f"Completed custom analysis. Total of {total_notes} notes ({len(new_notes)} new, {len(existing_notes)} reused from existing)")
            return all_notes
            
        except Exception as e:
            logger.error(f"Error in custom_analysis: {str(e)}")
            return []
        
    async def document_exists(self, document_id: str) -> bool:
        """
        Check if a document exists in the database
        
        Args:
            document_id: ID of the document to check
            
        Returns:
            True if the document exists, False otherwise
        """
        try:
            document = await self.document_repository.get_document(document_id)
            return document is not None
        except Exception as e:
            logger.error(f"Error checking if document exists: {str(e)}")
            return False
            
    async def identify_document_arguments(self, document_id: str) -> List[Dict[str, str]]:
        """
        Analyze a document to identify the primary overarching arguments that structure its reasoning.
        
        Args:
            document_id: ID of the document to analyze
            
        Returns:
            List of dictionaries with 'explanation' and 'name' for each overarching argument
        """
        try:
            # Check if document exists
            if not await self.document_exists(document_id):
                logger.error(f"Document {document_id} not found")
                return []
                
            # Get all chunks for the document
            chunks = await self.document_repository.get_chunks(document_id)
            
            # Sort chunks by sequence to maintain proper order
            chunks.sort(key=lambda x: x.sequence)
            
            if not chunks:
                logger.warning(f"No chunks found for document {document_id}")
                return []
                
            # Combine all chunk content into a single string
            combined_content = "\n\n".join([chunk.html_content for chunk in chunks])
            
            # Create prompt for the LLM
            prompt = f"""You are analyzing a legal document. Your task is to identify the primary overarching arguments that structure this document's reasoning.
            Here is the document content:
            {combined_content}
            """
            
            # Create message for LLM
            message = Message(
                id="system_prompt",
                conversation_id="temp",
                role=MessageRole.SYSTEM,
                content=prompt
            )
            
            user_message = Message(
                id="user_prompt",
                conversation_id="temp",
                role=MessageRole.USER,
                content="""You are analyzing a legal document. Your task is to identify the primary overarching arguments and key themes or critical terms that structure this document's reasoning.

                Follow these steps carefully:
                1. First, carefully read through the entire document to understand its overall structure and purpose.
                2. Identify recurring, foundational lines of reasoning that form the backbone of the document. These overarching arguments represent core positions or theses that organize main claims, definitions, citations, and conclusions.
                3. For each identified argument, create a brief explanation (1-3 sentences) capturing its essence and importance to the document, and assign a concise descriptive name (fewer than 8 words).
                4. Additionally, identify between 3-6 key themes or critical legal terms repeatedly discussed throughout the document. Themes or terms are foundational legal concepts, doctrines, principles, or distinctive recurring ideas explicitly addressed and central to the document's reasoning.
                
                For each theme or critical term identified:
                1. Provide the name of the theme or term (fewer than 8 words).
                2. Briefly define or explain how it is specifically being used or reasoned about within this document (1-2 sentences).
                Respond in exactly the following JSON format:
                {
                  "arguments": [
                    {
                      "explanation": "Concise explanation (1-3 sentences) capturing core reasoning and importance",
                      "name": "Descriptive argument name under 8 words"
                    }
                  ],
                  "themes": [
                    {
                      "theme_name": "Short, standardized name of theme or term (under 6 words)",
                      "explanation": "Brief explanation (1-2 sentences) of how the document explicitly invokes, defines, or relies upon this theme or term"
                    }
                  ]
                }

                Important guidelines:
                1. Always place the 'explanation' before the 'name' in arguments.
                2. Themes or critical terms should be distinct, important, and repeatedly referenced explicitly.
                3. Keep explanations brief (1-3 sentences), informative, and tightly focused.
                4. Argument and theme names should be concise and intuitive (themes under 6 words if possible).
                5. Ensure coverage is meaningful and representative of the document's overall reasoning structure.
                6. Respond ONLY with the requested JSON format above."""
            )
            
            # Define JSON schema for the structured response
            json_schema = {
                "type": "object",
                "properties": {
                    "arguments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "explanation": {
                                    "type": "string",
                                    "description": "A brief, clear explanation of the overarching argument. Include the main reasoning or principle behind it, and summarize why it matters to the overall structure of the document."
                                },
                                "name": {
                                    "type": "string",
                                    "description": "Short descriptive name for the overarching argument"
                                }
                            },
                            "required": ["explanation", "name"]
                        },
                        "minItems": 1,
                        "maxItems": 4
                    },
                    "key_themes_terms": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "explanation": {
                                    "type": "string",
                                    "description": "A brief explanation of how the document explicitly invokes, defines, or relies upon this theme or term"
                                },
                                "theme_name": {
                                    "type": "string",
                                    "description": "A short, standardized name for the theme or term"
                                }
                            },
                            "required": ["theme_name", "explanation"]
                        },
                        "minItems": 3,
                        "maxItems": 8
                    }
                },
                "required": ["arguments", "key_themes_terms"]
            }
            
            # Generate structured response
            result = await self.llm_service.generate_structured_response(
                messages=[message, user_message],
                response_format={"type": "json_object"},
                json_schema=json_schema
            )
            
            # Extract the arguments and key themes/terms arrays from the result object
            arguments = result.get("arguments", [])
            key_themes_terms = result.get("key_themes_terms", [])
            logger.info(f"Identified {len(arguments)} overarching arguments and {len(key_themes_terms)} key themes/terms for document {document_id}")
            
            # Save the arguments and key themes/terms to the document
            try:
                await self.document_repository.update_document_arguments(document_id, arguments)
                # Add a method to update key themes and terms in the document repository
                await self.document_repository.update_document_key_themes_terms(document_id, key_themes_terms)
                logger.info(f"Saved {len(arguments)} arguments and {len(key_themes_terms)} key themes/terms to document {document_id}")
            except Exception as e:
                logger.error(f"Error saving arguments or key themes/terms to document: {str(e)}")
                
            return arguments, key_themes_terms
            
        except Exception as e:
            logger.error(f"Error identifying document arguments: {str(e)}")
            return [], []
    
    async def analyze_document_chunks(self, document_id: str) -> List[ChunkIndex]:
        """
        Analyze all chunks in a document to extract notes and map them to arguments.
        
        This method processes all chunks in parallel to extract various elements
        like argumentative moves, contested definitions, etc.
        Each element is mapped to a document argument.
        
        Args:
            document_id: ID of the document to analyze
            
        Returns:
            List of ChunkIndex instances containing the analysis results
        """
        try:
            # First, check if document exists
            if not await self.document_exists(document_id):
                logger.error(f"Document {document_id} not found")
                return []
                
            # Get document arguments first
            document = await self.document_repository.get_document(document_id)
            
            # If no arguments exist, generate them first
            document_arguments, key_themes_terms = await self.identify_document_arguments(document_id)
            
            if not document_arguments:
                logger.warning(f"No arguments found for document {document_id}")
                return []
                
            # Get all chunks for the document
            chunks = await self.document_repository.get_chunks(document_id)
            
            # Sort chunks by sequence to maintain proper order (for consistency)
            chunks.sort(key=lambda x: x.sequence)
            
            if not chunks:
                logger.warning(f"No chunks found for document {document_id}")
                return []
             
            # Clear the case glossary for this document - we're not using it in parallel mode
            self.case_glossaries[document_id] = {}
                
            # Define a helper function to process a single chunk for arguments
            async def process_chunk_arguments(chunk):
                try:
                    # Analyze the chunk for arguments
                    analysis_result = await self._analyze_chunk(chunk, document_arguments)
                    
                    # Create a ChunkIndex from the analysis results
                    chunk_index = ChunkIndex.from_analysis_results(
                        chunk_id=chunk.id,
                        document_id=document_id,
                        sequence=chunk.sequence,
                        results=analysis_result
                    )
                    
                    # Save chunk index to database
                    await self.chunk_index_repository.create_chunk_index(chunk_index)
                    return chunk_index
                except Exception as e:
                    logger.error(f"Error processing chunk arguments {chunk.id}: {str(e)}")
                    return None
                    
            # Define a helper function to process a single chunk for key themes
            async def process_chunk_themes(chunk, key_themes_terms):
                try:
                    # Get key themes and terms analysis
                    theme_notes = await self._analyze_chunk_for_themes(chunk, key_themes_terms)
                    
                    # Save each note to the database
                    saved_notes = []
                    for note_data in theme_notes:
                        from src.models.rumination.key_term_note import KeyTermNote
                        
                        # Create a KeyTermNote
                        # Make sure we're creating a new object with proper datetime handling
                        from datetime import datetime
                        note = KeyTermNote(
                            document_id=document_id,
                            chunk_id=chunk.id,
                            chunk_sequence=chunk.sequence,
                            term=note_data["term"],
                            label=note_data["label"],
                            quote=note_data["quote"],
                            explanation=note_data["explanation"],
                            created_at=datetime.now()  # Explicitly set created_at to ensure it's a datetime object
                        )
                        
                        # Save to database
                        await self.key_term_repository.create_key_term_note(note)
                        saved_notes.append(note)
                        
                    return saved_notes
                except Exception as e:
                    logger.error(f"Error processing chunk themes {chunk.id}: {str(e)}")
                    return []
            
            # Process all chunks in parallel for both arguments and themes
            logger.info(f"Starting parallel analysis of {len(chunks)} chunks for document {document_id}")
            
            # Create tasks for both argument and theme analysis
            argument_tasks = [process_chunk_arguments(chunk) for chunk in chunks]
            theme_tasks = [process_chunk_themes(chunk, key_themes_terms) for chunk in chunks]
            
            # Run all tasks in parallel
            logger.info(f"Running {len(argument_tasks)} argument tasks and {len(theme_tasks)} theme tasks")
            argument_results, theme_results = await asyncio.gather(
                asyncio.gather(*argument_tasks),
                asyncio.gather(*theme_tasks)
            )
            
            # Filter out None results (from errors)
            results = [result for result in argument_results if result is not None]
            
            # Count the total number of theme notes extracted
            total_theme_notes = sum(len(notes) for notes in theme_results)
            logger.info(f"Extracted {total_theme_notes} theme notes across {len(chunks)} chunks")
            
            logger.info(f"Analyzed {len(results)} chunks for document {document_id} in parallel")
            return results
                
        except Exception as e:
            logger.error(f"Error analyzing document chunks: {str(e)}")
            return []
            
    async def _analyze_chunk_for_themes(self, chunk: Chunk, key_themes_terms: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze a single chunk specifically for key themes and terms.
        This function is designed to be run in parallel alongside _analyze_chunk.
        
        Args:
            chunk: Chunk to analyze
            key_themes_terms: List of key themes/terms to look for
            
        Returns:
            List of theme/term notes found in the chunk
        """
        import re
        # Clean HTML tags from content
        chunk_content = re.sub(r'<[^>]+>', ' ', chunk.html_content).strip()
        
        # Format key themes/terms for inclusion in the prompt
        themes_text = "\nKEY THEMES AND TERMS (look for these themes in the document):\n"
        for i, theme in enumerate(key_themes_terms):
            themes_text += f"{i+1}. {theme}\n"
        
        # Create messages for LLM
        messages = [
            Message(
                role=MessageRole.SYSTEM,
                content=(
                    "You are a legal analyst specializing in understanding key themes and terms in legal texts. "
                    "Your job is to identify text that relates to specific key themes and create notes about them. "
                    "For each theme or term, find relevant text and create structured notes that explain the connection. "
                    "Always use direct quotes from the text and provide clear explanations."
                ),
                conversation_id=chunk.document_id
            ),
            Message(
                role=MessageRole.USER,
                conversation_id=chunk.document_id,
                content=f"""
                    Analyze the following legal text for themes and terms:
                    ---
                    {chunk_content}
                    ---
                    {themes_text}
                    For each quote that relates to any of the key themes, create a note with the following structure:

                    - explanation: A brief explanation of how this quote relates to the theme
                    - quote: The exact text from the document (use DIRECT QUOTES only)
                    - term: The key theme/term this note relates to
                    - label: A short descriptive label for this particular note (under 8 words)
                    
                    Return your response in this exact JSON format:
                    {{"notes": [{{
                        "explanation": "brief explanation of relevance",
                        "quote": "direct quote from the text",
                        "term": "name of the key term/theme",
                        "label": "short descriptive label"
                    }}]}}
                    
                    Only include notes that have a strong connection to one of the key themes.
                    The response MUST be valid JSON and follow the exact format shown above.
                    """
            )
        ]
        
        # Define JSON schema for the structured response
        json_schema = {
            "type": "object",
            "properties": {
                "notes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "term": {"type": "string"},
                            "label": {"type": "string"},
                            "quote": {"type": "string"},
                            "explanation": {"type": "string"}
                        },
                        "required": ["term", "label", "quote", "explanation"]
                    }
                }
            },
            "required": ["notes"]
        }
        
        try:
            # Generate structured response using the same method as _analyze_chunk
            response = await self.llm_service.generate_structured_response(
                messages=messages,
                response_format={"type": "json_object"},
                json_schema=json_schema
            )
            
            # Extract notes from the response
            notes = []
            if response and "notes" in response:
                notes = response["notes"]
        except Exception as e:
            logger.error(f"Error parsing theme notes from LLM response: {str(e)}")
        
        return notes
        
    async def _analyze_chunk(self, chunk: Chunk, document_arguments: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Analyze a single chunk to extract notes and map them to arguments.
        
        Args:
            chunk: Chunk to analyze
            document_arguments: List of document arguments
            
        Returns:
            Dictionary of analysis results
        """
        import re
        # Clean HTML tags from content
        chunk_content = re.sub(r'<[^>]+>', ' ', chunk.html_content).strip()
        
        # In parallel mode, we don't use the case glossary
        case_glossary_text = ""

        # Format document arguments for inclusion in the prompt
        arguments_text = "\nDOCUMENT ARGUMENTS (assign each element to one of these):\n"
        
        # Log document arguments being used for this analysis
        logger.info(f"Document {chunk.document_id}, Chunk {chunk.id}: Using {len(document_arguments)} arguments for analysis")
        for i, arg in enumerate(document_arguments):
            arg_name = arg.get("name", f"Argument {i+1}")
            # Get the ID if present, otherwise generate it using the same logic as repository
            if "id" in arg:
                arg_id = arg["id"]
            else:
                # Match the repository's ID generation logic
                name_slug = arg_name
                arg_id = ''.join(c if c.isalnum() else '_' for c in name_slug.lower())
            arg_explanation = arg.get("explanation", "")
            
            # Log each argument to ensure consistency
            logger.info(f"Argument {i+1}: {arg_name} (id: {arg_id})")
            
            arguments_text += f"{i+1}. {arg_name} (id: {arg_id}): {arg_explanation}\n"

        # Create messages for LLM
        messages = [
            Message(
                role=MessageRole.SYSTEM,
                content=(
                    "You are a legal analyst specializing in legal analysis. "
                    "Your job is to deeply understand a single chunk of a legal case / document and produce actionable insights for a team working on the entire document."
                    "Begin by summarizing the chunk in a brief but highly informative manner."
                    "Extract specific argumentative elements from provided chunk, using direct quotes exclusively, to provide an efficient entry point for a team who needs to understand how the case develops in this chunk."
                    "Identify clearly and explicitly present elements only, following strict formatting guidelines."
                    "For each element you identify, you must assign it to one of the document's overarching arguments."
                ),
                conversation_id=chunk.document_id
            ),
            Message(
                role=MessageRole.USER,
                conversation_id=chunk.document_id,
                content=f"""
                    Analyze the following Supreme Court opinion chunk:
                    ---
                    {chunk_content}
                    ---
                    {case_glossary_text}
                    {arguments_text}
                    For each chunk, identify argumentative elements as described below. Use DIRECT QUOTES only—never paraphrase. 

                    MANDATORY ELEMENTS (always identify clearly if present):

                    1. SUMMARY:
                      - Brief summary of the chunk in a few sentences.

                    2. AUTHORITY_REFERENCES:
                      - Cases, historical figures, philosophers explicitly cited.
                      - Format: if a case, ONLY USE THE CASE NAME "X v. Y" format. Otherwise, use the name of the philosopher / producer (e.g., "John Stuart Mill").
                      - For legal cases, ALWAYS use the full "X v. Y" format in the label when it appears in the text.
                      - If only part of a case name is mentioned, use just that part as it appears in the text.
                      - DO NOT INCLUDE YEAR. Keep as standardized as possible.

                    3. CONTESTED_DEFINITIONS:
                      - Explicitly defined or contested key terms.
                      - Format: "TERM"

                    4. ARGUMENTATIVE_MOVES:
                      - Explicit argumentative maneuvers or reframings.
                      - Format: "MOVE_TYPE"

                    5. COUNTER_RESPONSES:
                      - Explicit rebuttals or engagements with opposing arguments.
                      - Format: "RESPONSE_TYPE"

                    OPTIONAL ELEMENTS (include ONLY if explicitly meaningful in context):

                    - CORE_PRINCIPLES:
                      - Fundamental principles explicitly highlighted.
                    - IDENTITY_CLAIMS:
                      - Explicit essential group characteristics mentioned.
                    - INSTITUTIONAL_FUNCTIONS:
                      - Explicit statements describing institutions' roles/functions.

                    STANDARDIZATION:
                    - All labels: concise, ALL_CAPS (2-6 words).
                    - Direct quotes ONLY.
                    - Be specific and detailed in your explanations. These "index cards" should be enough to serve as notes for reviewers not reading the passage to understand your point.
                    - Remember, CASES should be in the format "A v. B" with no added descriptions or text, such as "Lawrence v. Texas".
                    - For EACH element you identify, assign it to one of the document arguments by adding an "argument_id" field.

                    Return structured JSON exactly like this:

                    {{
                      "SUMMARY": "",
                      "AUTHORITY_REFERENCES": [],
                      "CONTESTED_DEFINITIONS": [],
                      "ARGUMENTATIVE_MOVES": [],
                      "COUNTER_RESPONSES": [],
                      "CORE_PRINCIPLES": [],
                      "IDENTITY_CLAIMS": [],
                      "INSTITUTIONAL_FUNCTIONS": []
                    }}
                    """
            )
        ]

        # Define JSON schema for the structured response
        element_properties = {
            "quote": {"type": "string"},
            "explanation": {"type": "string"},
            "label": {"type": "string"},
            "argument_id": {"type": "string"}
        }
        
        json_schema = {
            "type": "object",
            "properties": {
                "SUMMARY": {"type": "string"},
                **{key: {"type": "array", "items": {
                    "type": "object",
                    "properties": element_properties,
                    "required": ["quote", "explanation", "label", "argument_id"]
                }} for key in [
                    "AUTHORITY_REFERENCES",
                    "CONTESTED_DEFINITIONS",
                    "ARGUMENTATIVE_MOVES",
                    "COUNTER_RESPONSES",
                    "CORE_PRINCIPLES",
                    "IDENTITY_CLAIMS",
                    "INSTITUTIONAL_FUNCTIONS"
                ]}
            },
            "required": ["SUMMARY"]
        }

        try:
            # Generate structured response
            response = await self.llm_service.generate_structured_response(
                messages=messages,
                response_format={"type": "json_object"},
                json_schema=json_schema
            )

            # Ensure arrays are present even if empty
            for key in ["AUTHORITY_REFERENCES", "CONTESTED_DEFINITIONS", "ARGUMENTATIVE_MOVES", 
                       "COUNTER_RESPONSES", "CORE_PRINCIPLES", "IDENTITY_CLAIMS", "INSTITUTIONAL_FUNCTIONS"]:
                if key not in response:
                    response[key] = []
                    
            # Ensure SUMMARY is present
            if "SUMMARY" not in response:
                response["SUMMARY"] = ""

            return response

        except Exception as e:
            logger.error(f"Error analyzing chunk {chunk.id}: {str(e)}")
            return {
                "SUMMARY": "",
                "AUTHORITY_REFERENCES": [],
                "CONTESTED_DEFINITIONS": [],
                "ARGUMENTATIVE_MOVES": [],
                "COUNTER_RESPONSES": [],
                "CORE_PRINCIPLES": [],
                "IDENTITY_CLAIMS": [],
                "INSTITUTIONAL_FUNCTIONS": []
            }
            
    async def _filter_chunks(self, chunk: Chunk, term_categories: Dict[str, List[str]]) -> bool:
        """
        Filter chunks based on the presence of terms either directly or through embedding similarity.
        
        Args:
            chunk: Chunk to analyze
            term_categories: Dictionary mapping category names to lists of terms
            
        Returns:
            bool: True if at least one term is found in the chunk, False otherwise
        """
        # Clean HTML tags from content
        chunk_content = re.sub(r'<[^>]+>', ' ', chunk.html_content).strip()
        chunk_content_lower = chunk_content.lower()
        
        # Flatten all terms into a single list
        all_terms = [term.lower() for terms in term_categories.values() for term in terms]
        
        # Step 1: Check if any term is directly in the chunk content (exact match)
        for term in all_terms:
            if term.lower() in chunk_content_lower:
                logger.debug(f"Term '{term}' found directly in chunk {chunk.id}")
                return True
        
        # Step 2: If no direct match, check using embeddings with batched requests
        try:
            # Get embedding for the chunk (do this only once)
            chunk_embedding = self.client.embeddings.create(
                input=[chunk_content[:8000]],  # Limit to 8000 chars for API
                model="text-embedding-3-small",
                encoding_format="float"
            ).data[0].embedding
            
            # Batch all terms into a single embedding request (more efficient)
            # Only proceed if we have terms to check
            if all_terms:
                batch_term_embeddings = self.client.embeddings.create(
                    input=all_terms,
                    model="text-embedding-3-small",
                    encoding_format="float"
                ).data
                
                # Check similarity for each term embedding
                for i, term_data in enumerate(batch_term_embeddings):
                    term_embedding = term_data.embedding
                    term = all_terms[i]
                    
                    # Calculate cosine similarity
                    similarity = self._cosine_similarity(chunk_embedding, term_embedding)
                    
                    # If similarity is high enough, consider it a match
                    if similarity > 0.6:  # Threshold can be adjusted
                        logger.debug(f"Term '{term}' has high similarity ({similarity:.2f}) with chunk {chunk.id}")
                        return True
        
        except Exception as e:
            logger.error(f"Error during embedding similarity check: {str(e)}")
            # If embedding fails, fall back to direct text matching only
        
        # No matches found
        return False
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            float: Cosine similarity between vectors (between -1 and 1)
        """
        import math
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0
            
        return dot_product / (magnitude1 * magnitude2)
        
    async def _analyze_chunk_with_custom_terms(self, chunk: Chunk, term_categories: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """
        Analyze a single chunk for custom term categories.
        
        Args:
            chunk: Chunk to analyze
            term_categories: Dictionary mapping category names to lists of terms
            
        Returns:
            List of notes found in the chunk for the specified terms
        """
        # Clean HTML tags from content
        chunk_content = re.sub(r'<[^>]+>', ' ', chunk.html_content).strip()
        
        # Format term categories for inclusion in the prompt
        categories_text = "\nANALYSIS TARGETS (look specifically for these items in the document):\n"
        
        for category_name, terms in term_categories.items():
            categories_text += f"\n{category_name.upper()}:\n"
            for i, term in enumerate(terms):
                categories_text += f"{i+1}. {term}\n"
        
        # Create messages for LLM
        messages = [
            Message(
                role=MessageRole.SYSTEM,
                content=(
                    "You are a legal analyst specializing in understanding legal texts. "
                    "Your job is to identify text that relates to specific targeted terms and create detailed notes about them. "
                    "For each target term, find relevant text and create structured notes that explain the connection. "
                    "Always use direct quotes from the text and provide clear explanations."
                ),
                conversation_id=chunk.document_id
            ),
            Message(
                role=MessageRole.USER,
                conversation_id=chunk.document_id,
                content=f"""
                    Analyze the following legal text for the specified target items:
                    ---
                    {chunk_content}
                    ---
                    {categories_text}
                    For each quote that relates to any of the target items, create a note with the following structure:

                    - explanation: A brief explanation of how this quote relates to the target item
                    - quote: The exact text from the document (use DIRECT QUOTES only)
                    - term: The specific target item this note relates to (exact match to one listed above)
                    - category: The category of the target item (e.g., "key vocabulary", "concepts", etc.)
                    - label: A short descriptive label for this particular note (under 8 words)
                    
                    Return your response in this exact JSON format:
                    {{"notes": [
                        {{
                            "explanation": "brief explanation of relevance",
                            "quote": "direct quote from the text",
                            "term": "name of the target item",
                            "category": "category of the term",
                            "label": "short descriptive label"
                        }}
                    ]}}
                    
                    Only include notes that have a strong, explicit connection to one of the target items.
                    The response MUST be valid JSON and follow the exact format shown above.
                    """
            )
        ]
        
        # Define JSON schema for the structured response
        json_schema = {
            "type": "object",
            "properties": {
                "notes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "term": {"type": "string"},
                            "category": {"type": "string"},
                            "label": {"type": "string"},
                            "quote": {"type": "string"},
                            "explanation": {"type": "string"}
                        },
                        "required": ["term", "category", "label", "quote", "explanation"]
                    }
                }
            },
            "required": ["notes"]
        }
        
        try:
            # Generate structured response
            response = await self.llm_service.generate_structured_response(
                messages=messages,
                response_format={"type": "json_object"},
                json_schema=json_schema
            )
            
            # Extract notes from the response
            notes = []
            if response and "notes" in response:
                notes = response["notes"]
                
                # Add document_id to each note
                for note in notes:
                    note["document_id"] = chunk.document_id
            
            logger.info(f"Extracted {len(notes)} custom term notes from chunk {chunk.id}")
            return notes
            
        except Exception as e:
            logger.error(f"Error analyzing chunk with custom terms {chunk.id}: {str(e)}")
            return []
        
    async def _update_case_glossary(self, document_id: str, analysis_result: Dict[str, Any]) -> None:
        """
        Update the case glossary for a document based on analysis results.
        Stores ALL authority references, not just case citations.
        
        Args:
            document_id: ID of the document
            analysis_result: Analysis results for a chunk
        """
        try:
            # Initialize glossary if it doesn't exist
            if document_id not in self.case_glossaries:
                self.case_glossaries[document_id] = {}
                
            # Extract authority references
            authority_references = analysis_result.get("AUTHORITY_REFERENCES", [])
            print(f"DEBUG - _update_case_glossary - Found {len(authority_references)} authority references in analysis result")
            
            if authority_references:
                print(f"DEBUG - Authority references raw data: {authority_references}")
            
            # Update glossary with ALL authority references
            refs_added = 0
            for ref in authority_references:
                label = ref.get("label", "")
                quote = ref.get("quote", "")
                explanation = ref.get("explanation", "")
                
                print(f"DEBUG - Processing reference with label: '{label}'")
                
                if label:  # As long as there's a label, add it to the glossary
                    # Prepare a descriptive explanation
                    description = explanation if explanation else quote
                    if not description:
                        description = "Authority reference"
                    
                    # Add to glossary if not already present
                    if label not in self.case_glossaries[document_id]:
                        self.case_glossaries[document_id][label] = description
                        refs_added += 1
                        print(f"DEBUG - Added reference to glossary: '{label}'")
                    
                # Special handling for case citations (for backward compatibility)
                if label and (" v. " in label.lower() or " vs. " in label.lower()):
                    # Standardize format (remove year and other extra info)
                    case_name = label.split("(")[0].strip()
                    print(f"DEBUG - Reference identified as case citation: '{case_name}'")
            
            print(f"DEBUG - _update_case_glossary - Added {refs_added} new references to glossary for document {document_id}")
            print(f"DEBUG - Current case glossary contents: {self.case_glossaries[document_id]}")
                        
        except Exception as e:
            logger.error(f"Error updating case glossary for document {document_id}: {str(e)}")
    