# services/document/semantic_chunking_service.py
import logging
from typing import List, Tuple, Dict, Any, Optional
import os
import numpy as np
import re
from openai import OpenAI
from src.models.viewer.block import Block
from src.models.base.chunk import Chunk
import uuid

logger = logging.getLogger(__name__)

# Global model cache for perplexity calculations
_GPT2_MODEL = None
_GPT2_TOKENIZER = None

def get_gpt2_model_and_tokenizer():
    """Get or initialize the GPT-2 model and tokenizer."""
    global _GPT2_MODEL, _GPT2_TOKENIZER
    
    if _GPT2_MODEL is None or _GPT2_TOKENIZER is None:
        from transformers import GPT2LMHeadModel, GPT2Tokenizer
        import torch
        
        logger.info("Initializing GPT-2 model and tokenizer for perplexity calculations")
        _GPT2_TOKENIZER = GPT2Tokenizer.from_pretrained('gpt2')
        _GPT2_MODEL = GPT2LMHeadModel.from_pretrained('gpt2')
        _GPT2_MODEL.eval()
    
    return _GPT2_MODEL, _GPT2_TOKENIZER

class ChunkingService:
    """Service for semantically chunking document blocks into coherent units."""
    
    def __init__(self, 
                 embedding_model_name="text-embedding-3-small",
                 target_chunk_size=250, 
                 similarity_threshold=0.65,
                 respect_structure=True):
        """
        Initialize the chunking service.
        
        Args:
            embedding_model_name: OpenAI embedding model to use
            target_chunk_size: Target size of chunks in tokens/words
            similarity_threshold: Threshold for semantic similarity (0-1)
            respect_structure: Whether to enforce structural boundaries (headers, etc.)
        """
        self.embedding_model_name = embedding_model_name
        self.target_chunk_size = target_chunk_size
        self.similarity_threshold = similarity_threshold
        self.respect_structure = respect_structure
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    async def process_document(self, blocks: List[Block]) -> List[Chunk]:
        """
        Process document blocks and create semantic chunks.
        
        Args:
            blocks: List of blocks from Marker API
            
        Returns:
            List of semantic chunks
        """
        logger.info(f"Processing {len(blocks)} blocks for semantic chunking")
        
        # Skip if no blocks
        if not blocks or len(blocks) == 0:
            logger.warning("No blocks to process for semantic chunking")
            return []
            
        # Get document ID from blocks
        document_id = blocks[0].document_id
        
        # Pre-filter non-content blocks
        content_blocks = self._filter_content_blocks(blocks)
        
        # Skip if no content blocks remain after filtering
        if not content_blocks:
            logger.warning("No content blocks found after filtering")
            return []
        
        # Enrich blocks with metadata and clean text
        enriched_blocks = self._enrich_blocks(content_blocks)
        
        # Create initial chunks
        initial_chunks = self._create_initial_chunks(enriched_blocks)
        
        # Refine chunks with embeddings
        refined_chunks = self._refine_with_embeddings(initial_chunks)
        
        # Convert to Chunk models
        chunk_models = self._create_chunk_models(refined_chunks, document_id)
        
        logger.info(f"Created {len(chunk_models)} semantic chunks")
        
        # Dump detailed chunk information for inspection
        self._dump_chunk_details(chunk_models, refined_chunks)
        
        return chunk_models
        
    def _filter_content_blocks(self, blocks: List[Block]) -> List[Block]:
        """
        Filter out non-content blocks like headers, footers, and empty blocks.
        
        Args:
            blocks: Original list of marker blocks
            
        Returns:
            Filtered list containing only meaningful content blocks
        """
        # Define block types that typically don't contain meaningful content
        non_content_types = {
            "PageHeader", 
            "PageFooter",
            "PageNumber",
            "Footnote",
            "Reference"
        }
        
        # Define a minimum content length to filter out nearly-empty blocks
        min_content_length = 5  # Characters
        
        filtered_blocks = []
        
        for block in blocks:
            # Skip blocks with non-content types
            if block.block_type in non_content_types:
                continue
                
            # Skip blocks with empty or very short content
            content = block.html_content or ""
            clean_content = re.sub(r'<[^>]+>', '', content).strip()
            if len(clean_content) < min_content_length:
                continue
                
            filtered_blocks.append(block)
        
        # Log how many blocks were filtered out
        original_count = len(blocks)
        filtered_count = len(filtered_blocks)
        removed_count = original_count - filtered_count
        
        logger.info(f"Filtered out {removed_count} non-content blocks ({removed_count/original_count:.1%} of total)")
        logger.info(f"Proceeding with {filtered_count} content blocks")
        
        return filtered_blocks
    
    def _enrich_blocks(self, blocks: List[Block]) -> List[Dict[str, Any]]:
        """
        Enrich marker blocks with metadata useful for chunking decisions.
        """
        enriched = []
        
        for i, block in enumerate(blocks):
            # Log block info for debugging
            logger.debug(f"Processing block {i}: type={block.block_type}, page={block.page_number}")
            
            # Structural features
            is_structural_boundary = block.block_type.lower() in {
                "sectionheader", 
                "pageheader",
                "tableofcontents"
            }

            is_group = block.block_type in {
                "ListGroup",
                "TableGroup",
                "FigureGroup",
                "PictureGroup"
            }
            
            is_group_item = block.block_type in {
                "ListItem",
                "TableCell",
                "Caption"
            }
            
            # Get clean text and token count
            html_content = block.html_content if hasattr(block, 'html_content') else ""
            clean_text = self._extract_text_from_html(html_content)
            
            # Estimate token count (rough approximation)
            word_count = len(clean_text.split())
            token_count = int(word_count * 1.3)  # Rough estimate: tokens ≈ 1.3 * words
            
            # Package all features together
            enriched.append({
                'original': block,
                'original_index': i,  # Store the original index for tracking continuations
                'block_type': block.block_type,
                'page_number': block.page_number,
                'is_structural_boundary': is_structural_boundary,
                'clean_text': clean_text,
                'token_count': token_count,
                'word_count': word_count,
                'is_group': is_group,
                'is_group_item': is_group_item
            })
        
        logger.info(f"Enriched {len(enriched)} blocks")
        return enriched
    
    def _create_initial_chunks(self, enriched_blocks: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """
        Create initial chunks based on semantic boundaries rather than page boundaries.
        
        Args:
            enriched_blocks: Enriched marker blocks
            
        Returns:
            Initial chunks of blocks
        """
        # Detect page boundary continuations first
        continuations = self._detect_page_boundary_continuations(enriched_blocks)
        logger.info(f"Detected {len(continuations)} page boundary continuations")
        
        # Create mapping of blocks that should stay together
        continuation_pairs = []
        for block_idx, continuation_idx in continuations.items():
            block_text = enriched_blocks[block_idx]['clean_text'][-50:]  # Last 50 chars
            cont_text = enriched_blocks[continuation_idx]['clean_text'][:50]  # First 50 chars
            logger.info(f"Found continuation: '{block_text}' -> '{cont_text}'")
            continuation_pairs.append((block_idx, continuation_idx))
        
        chunks = []
        current_chunk = []
        current_size = 0
        i = 0
        
        # Process blocks with awareness of continuations
        while i < len(enriched_blocks):
            block = enriched_blocks[i]
            
            # Check if this block has a continuation
            if i in continuations:
                # Get the continuation block index
                continuation_idx = continuations[i]
                continuation_block = enriched_blocks[continuation_idx]
                
                logger.info(f"Processing continuation: Block {i} continues with block {continuation_idx}")
                logger.debug(f"  Incomplete text: '{block['clean_text'][-50:]}'")
                logger.debug(f"  Continuation: '{continuation_block['clean_text'][:50]}'")
                
                # Add this block to current chunk
                current_chunk.append(block)
                current_size += block['word_count']
                
                # Also add the continuation block
                current_chunk.append(continuation_block)
                current_size += continuation_block['word_count']
                
                # Skip the continuation block in next iteration
                i = continuation_idx + 1
                continue
            
            # Always start a new chunk at structural boundaries if configured
            new_chunk_needed = False
            
            if self.respect_structure and block['is_structural_boundary'] and current_chunk:
                new_chunk_needed = True
                logger.debug(f"Creating new chunk due to structural boundary: {block['clean_text'][:30]}...")
                
            # For regular blocks, check if adding would exceed target size
            elif current_size + block['word_count'] > self.target_chunk_size * 1.5 and current_chunk:
                new_chunk_needed = True
                logger.debug(f"Creating new chunk due to size limit ({current_size} words + {block['word_count']} words)")
                
            # If we need a new chunk
            if new_chunk_needed:
                chunks.append(current_chunk)
                current_chunk = [block]
                current_size = block['word_count']
                i += 1
                continue
                    
            # Handle groups - keep them together if possible
            if block['is_group'] or block['is_group_item']:
                # If adding this group would make the chunk too big and we already have content,
                # finish the current chunk
                if current_size + block['word_count'] > self.target_chunk_size * 1.8 and current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = [block]
                    current_size = block['word_count']
                else:
                    current_chunk.append(block)
                    current_size += block['word_count']
                i += 1
                continue
                    
            # Add block to current chunk
            current_chunk.append(block)
            current_size += block['word_count']
            i += 1
                    
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append(current_chunk)
        
        # Check for oversized chunks (which might happen due to continuations) and split if necessary
        # Pass continuations to ensure they're not split apart
        chunks = self._split_oversized_chunks(chunks, continuations)
        
        # Log chunk info
        chunk_sizes = [sum(block['word_count'] for block in chunk) for chunk in chunks]
        chunk_pages = [sorted(list({b['page_number'] for b in chunk if b['page_number'] is not None})) for chunk in chunks]
        
        # Log chunk information
        for i, (size, pages) in enumerate(zip(chunk_sizes, chunk_pages)):
            page_info = f"pages {pages}" if pages else "unknown pages"
            logger.debug(f"Chunk {i+1}: {size} words, {page_info}")
        
        logger.info(f"Created {len(chunks)} initial chunks with sizes: {chunk_sizes}")
        
        return chunks
    
    def _refine_with_embeddings(self, chunks: List[List[Dict[str, Any]]]) -> List[List[Dict[str, Any]]]:
        """
        Smart refinement that primarily focuses on merging small chunks with their most similar neighbor.
        Larger chunks are preserved to maintain document structure.
        
        Args:
            chunks: Initial chunks of blocks
            
        Returns:
            Refined chunks with small chunks merged into adjacent larger chunks
        """
        # If only one chunk, no need to refine
        if len(chunks) <= 1:
            return chunks
        
        # Calculate chunk sizes
        chunk_sizes = [sum(block['word_count'] for block in chunk) for chunk in chunks]
        logger.debug(f"Initial chunk sizes: {chunk_sizes}")
        
        # Define a threshold for "small" chunks that should be merged
        small_chunk_threshold = self.target_chunk_size * 0.4  # e.g., 100 words if target is 250
        
        # Get text for each chunk for embedding comparison
        chunk_texts = []
        for chunk in chunks:
            # Combine clean text from each block
            combined_text = ' '.join(block['clean_text'] for block in chunk)
            # Truncate if needed for embedding API
            if len(combined_text) > 8000:
                combined_text = combined_text[:8000]
            # Ensure there's at least some content
            if len(combined_text.strip()) < 10:
                combined_text = "Empty chunk placeholder"
            chunk_texts.append(combined_text)
        
        # Compute embeddings
        embeddings = []
        for text in chunk_texts:
            try:
                response = self.client.embeddings.create(
                    input=[text], 
                    model=self.embedding_model_name,
                    encoding_format="float"
                )
                embedding = response.data[0].embedding
                embeddings.append(embedding)
            except Exception as e:
                logger.error(f"Error getting embedding: {e}")
                embeddings.append([0.0] * 1536)  # Default embedding dimension
        
        # Identify small chunks and their indices
        small_chunk_indices = [i for i, size in enumerate(chunk_sizes) if size < small_chunk_threshold]
        logger.info(f"Found {len(small_chunk_indices)} small chunks to merge: {[chunk_sizes[i] for i in small_chunk_indices]}")
        
        # Create a new list of chunks that will be our result
        result_chunks = chunks.copy()
        
        # Track which chunks have been merged and should be removed
        merged_indices = set()
        
        # Process the small chunks from the end to start to avoid index shifting issues
        for small_idx in sorted(small_chunk_indices, reverse=True):
            # Skip if this chunk was already merged in a previous iteration
            if small_idx in merged_indices:
                continue
                
            # Determine candidate neighbors for merging
            candidates = []
            
            # Check if we have a preceding neighbor
            if small_idx > 0 and (small_idx - 1) not in merged_indices:
                similarity = self._cosine_similarity(embeddings[small_idx], embeddings[small_idx - 1])
                candidates.append((small_idx - 1, similarity))
                
            # Check if we have a following neighbor
            if small_idx < len(chunks) - 1 and (small_idx + 1) not in merged_indices:
                similarity = self._cosine_similarity(embeddings[small_idx], embeddings[small_idx + 1])
                candidates.append((small_idx + 1, similarity))
                
            # If we have candidates, merge with the most similar one
            if candidates:
                # Sort by similarity (highest first)
                candidates.sort(key=lambda x: x[1], reverse=True)
                target_idx, similarity = candidates[0]
                
                # Log the merge decision
                logger.debug(f"Merging chunk {small_idx} (size {chunk_sizes[small_idx]}) into chunk {target_idx} (size {chunk_sizes[target_idx]}) with similarity {similarity:.2f}")
                
                # Determine the merge order (keep chronological order)
                if small_idx < target_idx:
                    # Small chunk comes before target
                    result_chunks[target_idx] = chunks[small_idx] + chunks[target_idx]
                else:
                    # Small chunk comes after target
                    result_chunks[target_idx] = chunks[target_idx] + chunks[small_idx]
                    
                # Mark the small chunk for removal
                merged_indices.add(small_idx)
        
        # Remove the merged chunks from our result (in reverse order to avoid index issues)
        for idx in sorted(merged_indices, reverse=True):
            del result_chunks[idx]
        
        # Calculate similarity metrics for logging
        similarities = []
        for i in range(1, len(chunks)):
            similarity = self._cosine_similarity(embeddings[i-1], embeddings[i])
            similarities.append(round(similarity, 2))
        
        # Calculate refined chunk sizes
        refined_sizes = [sum(block['word_count'] for block in chunk) for chunk in result_chunks]
        
        # Log detailed refinement info
        logger.info(f"Chunk similarities: {similarities}")
        logger.info(f"Refined to {len(result_chunks)} chunks (from {len(chunks)})")
        logger.info(f"Refined chunk sizes: {refined_sizes}")
        
        return result_chunks
    
    def _cosine_similarity(self, vec1, vec2) -> float:
        """Compute cosine similarity between two vectors."""
        # Convert to numpy arrays for efficiency
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        # Compute dot product and norms
        dot = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        # Avoid division by zero
        if norm1 == 0 or norm2 == 0:
            return 0
            
        return dot / (norm1 * norm2)
        
    def _create_chunk_models(self, chunks: List[List[Dict[str, Any]]], document_id: str) -> List[Chunk]:
      """
      Convert internal chunk representation to Chunk models.
      
      Args:
          chunks: List of chunks, where each chunk is a list of enriched blocks
          document_id: ID of the document
          
      Returns:
          List of Chunk models
      """
      chunk_models = []
      
      for i, chunk in enumerate(chunks):
          # Get all original blocks
          blocks = [item['original'] for item in chunk]
          
          # Get basic chunk info
          block_ids = [block.id for block in blocks]
          
          # Extract page numbers safely
          page_numbers = [block.page_number for block in blocks if block.page_number is not None]
          if page_numbers:
              first_page = min(page_numbers)
              last_page = max(page_numbers)
          else:
              # Default to page 1 if no page numbers are found
              first_page = 1
              last_page = 1
          
          # Extract text content
          html_content = ''.join(block.html_content or '' for block in blocks)
          
          # Create chunk model
          chunk_model = Chunk(
              document_id=document_id,
              title=f"Chunk {i+1}",
              sequence=i,
              page_range=[first_page, last_page],
              block_ids=block_ids,
              html_content=html_content,
              # We could add more metadata or computed fields here
          )
          
          chunk_models.append(chunk_model)
              
      return chunk_models

    def _extract_text_from_html(self, html: str) -> str:
        """Extract plain text from HTML content
        
        Args:
            html: HTML content
            
        Returns:
            Plain text
        """
        if not html:
            return ""
        
        # Replace HTML tags
        clean_text = re.sub(r'<[^>]*>', ' ', html)
        
        # Replace multiple whitespace with single space
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        return clean_text.strip()
    
    def _detect_page_boundary_continuations(self, enriched_blocks: List[Dict[str, Any]]) -> Dict[int, int]:
        """
        Detect blocks that continue across page boundaries.
        
        Returns a dictionary mapping block indices to their continuation block indices.
        """
        continuations = {}  # Maps block_idx -> continuation_block_idx
        
        # Group blocks by page
        page_blocks = {}
        for i, block in enumerate(enriched_blocks):
            page = block.get('page_number')
            if page not in page_blocks:
                page_blocks[page] = []
            page_blocks[page].append((i, block))
            
        logger.info(f"Checking for continuations across {len(page_blocks)} pages")
        
        # Process each page (except the last)
        for page_num in sorted(page_blocks.keys())[:-1]:
            next_page_num = page_num + 1
            
            # Skip if next page doesn't exist
            if next_page_num not in page_blocks:
                logger.debug(f"Skipping page {page_num} - no next page")
                continue
                
            # Get text blocks from this page and the next
            curr_page_text_blocks = [(i, b) for i, b in page_blocks[page_num] 
                                   if b['block_type'] == 'Text']
            
            if not curr_page_text_blocks:
                logger.debug(f"Skipping page {page_num} - no text blocks")
                continue
                
            # Get the last text block on this page
            last_idx, last_block = curr_page_text_blocks[-1]
            
            logger.info(f"Checking if block on page {page_num} is an incomplete sentence: '{last_block['clean_text'][-100:]}'")
            
            # Check if it ends with an incomplete sentence
            if self._is_incomplete_sentence(last_block['clean_text']):
                logger.info(f"Confirmed that block on page {page_num} is an incomplete sentence")
                
                # Look for continuation on next page
                next_page_text_blocks = [(i, b) for i, b in page_blocks[next_page_num] 
                                       if b['block_type'] == 'Text'][:5]  # Consider first 5 text blocks
                
                if next_page_text_blocks:
                    logger.info(f"Found {len(next_page_text_blocks)} candidate continuations on page {next_page_num}")
                    
                    # Use perplexity-based continuation finding instead of embedding similarity
                    continuation_idx = self._find_continuation_with_perplexity(
                        last_block['clean_text'],
                        [b['clean_text'] for _, b in next_page_text_blocks]
                    )
                    
                    if continuation_idx >= 0:
                        # Map the last block to its continuation
                        cont_idx = next_page_text_blocks[continuation_idx][0]
                        continuations[last_idx] = cont_idx
                        
                        logger.info(f"Detected continuation from block {last_idx} (page {page_num}) to block {cont_idx} (page {next_page_num})")
                        logger.info(f"  Text: '{last_block['clean_text'][-50:]}' -> '{next_page_text_blocks[continuation_idx][1]['clean_text'][:50]}'")
                else:
                    logger.info(f"No candidate continuations found on page {next_page_num}")
        
        logger.info(f"Detected {len(continuations)} page boundary continuations")
        return continuations

    def _is_incomplete_sentence(self, text: str) -> bool:
        """Check if text ends with an incomplete sentence."""
        # Simple check for ending punctuation
        if not text.strip():
            return False
            
        last_char = text.strip()[-1]
        if last_char not in ['.', '!', '?', '"', ';', ':', ')']:
            return True
            
        # Check for incomplete phrase markers
        ending_markers = ['and', 'or', 'but', 'yet', 'so', 'for', 'nor']
        for marker in ending_markers:
            if text.strip().lower().endswith(f" {marker}"):
                return True
                
        return False

    def _find_continuation_with_perplexity(self, incomplete_text: str, candidate_texts: List[str]) -> int:
        """Find the best continuation using language model perplexity."""
        # Import here to avoid importing if not used
        import torch
        
        # Get the cached model and tokenizer
        model, tokenizer = get_gpt2_model_and_tokenizer()
        
        # Get the ending of the incomplete text
        last_portion = incomplete_text[-150:]  # Last 150 chars for context
        
        best_idx = -1
        lowest_perplexity = float('inf')
        
        # Log what we're trying to match
        logger.info(f"Finding continuation for: '{last_portion}'")
        
        perplexities = []
        for i, candidate in enumerate(candidate_texts):
            # Take just the beginning of the candidate
            candidate_start = candidate[:100]
            
            try:
                # Combine texts and calculate perplexity
                combined = last_portion + " " + candidate_start
                tokens = tokenizer.encode(combined, return_tensors='pt')
                
                with torch.no_grad():
                    outputs = model(tokens, labels=tokens)
                    loss = outputs.loss
                    perplexity = torch.exp(loss).item()
                    
                perplexities.append(perplexity)
                logger.info(f"Perplexity between {last_portion} and {candidate_start}: {perplexity}")
                
                # Lower perplexity = more natural continuation
                if perplexity < lowest_perplexity:
                    lowest_perplexity = perplexity
                    best_idx = i
            except Exception as e:
                logger.error(f"Error calculating perplexity for candidate {i}: {str(e)}")
                continue
        
        # Log all perplexities for comparison
        if perplexities:
            sorted_indices = sorted(range(len(perplexities)), key=lambda i: perplexities[i])
            logger.info("Perplexity ranking:")
            for rank, idx in enumerate(sorted_indices):
                if idx < len(candidate_texts):
                    logger.info(f"  {rank+1}. Candidate {idx}: {perplexities[idx]:.2f} - '{candidate_texts[idx][:50]}'")
        
        # Only accept if perplexity is reasonably low
        threshold = 50  # This value would need tuning
        logger.info(f"Best continuation candidate: {best_idx} with perplexity: {lowest_perplexity}")
        
        if best_idx >= 0 and lowest_perplexity < threshold:
            logger.info(f"Selected continuation: '{candidate_texts[best_idx][:100]}'")
            return best_idx
        else:
            logger.info(f"No suitable continuation found (threshold: {threshold})")
            return -1

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for a text string."""
        try:
            # Use openai client directly for backward compatibility
            # In future refactoring, we could inject LLMService and use it here
            response = self.client.embeddings.create(
                input=[text],
                model=self.embedding_model_name,
                encoding_format="float"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            return [0.0] * 1536  # Default embedding dimension
            
    def _split_oversized_chunks(self, chunks: List[List[Dict[str, Any]]], continuations: Dict[int, int] = None) -> List[List[Dict[str, Any]]]:
        """
        Split any chunks that are too large into smaller chunks at sensible boundaries.
        Protects continuations from being split apart.
        """
        max_chunk_size = self.target_chunk_size * 2
        result_chunks = []
        
        # If no continuations provided, use empty dict
        if continuations is None:
            continuations = {}
            
        logger.info(f"Splitting oversized chunks with {len(continuations)} protected continuations")
            
        # Identify which chunks contain continuations
        chunk_continuations = {}  # chunk_idx -> list of (pos1, pos2) pairs
        
        # For each chunk, find any continuations it contains
        for chunk_idx, chunk in enumerate(chunks):
            chunk_continuations[chunk_idx] = []
            
            # Get original indices for blocks in this chunk
            original_indices = [block.get('original_index', -1) for block in chunk]
            
            # Check if any continuations are in this chunk
            for block_idx, continuation_idx in continuations.items():
                if block_idx in original_indices and continuation_idx in original_indices:
                    # Find their positions within this chunk
                    pos1 = original_indices.index(block_idx)
                    pos2 = original_indices.index(continuation_idx)
                    chunk_continuations[chunk_idx].append((pos1, pos2))
                    logger.info(f"Found continuation in chunk {chunk_idx}: positions {pos1} and {pos2}")
        
        # Process each chunk, being careful not to split continuations
        for chunk_idx, chunk in enumerate(chunks):
            chunk_size = sum(block['word_count'] for block in chunk)
            
            # Skip if chunk is not too large
            if chunk_size <= max_chunk_size:
                result_chunks.append(chunk)
                continue
                
            logger.info(f"Splitting oversized chunk {chunk_idx}: {chunk_size} words (max: {max_chunk_size})")
            
            # Get continuations in this chunk
            protected_pairs = chunk_continuations.get(chunk_idx, [])
            
            # Build a set of positions that are part of continuations
            protected_positions = set()
            for pos1, pos2 in protected_pairs:
                protected_positions.add(pos1)
                protected_positions.add(pos2)
            
            # Split the chunk, respecting protected positions
            current_split = []
            current_size = 0
            
            i = 0
            while i < len(chunk):
                block = chunk[i]
                
                # If this is a protected position
                if i in protected_positions:
                    # Find the pair this position is part of
                    for pos1, pos2 in protected_pairs:
                        if i == pos1 or i == pos2:
                            # Get the other position in the pair
                            other_pos = pos2 if i == pos1 else pos1
                            # Get the other block
                            other_block = chunk[other_pos]
                            
                            # Combined size of both blocks
                            combined_size = block['word_count'] + other_block['word_count']
                            
                            # If adding both blocks would make current split too large, finish it first
                            if current_size > 0 and current_size + combined_size > self.target_chunk_size * 1.5:
                                result_chunks.append(current_split)
                                current_split = []
                                current_size = 0
                            
                            # Make sure to add them in the right order
                            if i < other_pos:
                                logger.info(f"Keeping continuation together: positions {i} and {other_pos}")
                                # Add current block first, the other one will be added when we reach it
                                current_split.append(block)
                                current_size += block['word_count']
                            else:
                                # We're at the second block, first one already added
                                current_split.append(block)
                                current_size += block['word_count']
                            break
                    
                    i += 1
                    continue
                
                # Regular block processing - if adding this block would make split too large
                if current_size + block['word_count'] > self.target_chunk_size and current_split:
                    result_chunks.append(current_split)
                    current_split = [block]
                    current_size = block['word_count']
                else:
                    # Add to current split
                    current_split.append(block)
                    current_size += block['word_count']
                    
                i += 1
            
            # Add the last split if not empty
            if current_split:
                result_chunks.append(current_split)
        
        # Log results
        sizes = [sum(block['word_count'] for block in chunk) for chunk in result_chunks]
        logger.info(f"Split into {len(result_chunks)} chunks with sizes: {sizes}")
        
        return result_chunks
    
    def _dump_chunk_details(self, chunk_models: List[Chunk], refined_chunks: List[List[Dict[str, Any]]]):
        """Dump detailed chunk information for inspection
        
        This outputs comprehensive information about each chunk to help understand 
        where chunk boundaries were placed and what content is in each chunk.
        
        Args:
            chunk_models: List of final Chunk objects
            refined_chunks: The refined chunks before conversion to models
        """
        logger.info("=" * 80)
        logger.info("DETAILED CHUNK INFORMATION")
        logger.info("=" * 80)
        
        for i, (chunk_model, chunk_data) in enumerate(zip(chunk_models, refined_chunks)):
            # Get basic chunk info
            block_count = len(chunk_data)
            word_count = sum(block['word_count'] for block in chunk_data)
            
            logger.info(f"\nCHUNK {i+1}/{len(chunk_models)}")
            logger.info(f"ID: {chunk_model.id}")
            logger.info(f"Block Count: {block_count}")
            logger.info(f"Word Count: {word_count}")
            
            # Log block types in this chunk
            block_types = [block['block_type'] for block in chunk_data]
            logger.info(f"Block Types: {', '.join(block_types)}")
            
            # Log the beginning and end of the chunk content
            content_preview = ' '.join(block['clean_text'] for block in chunk_data)
            max_preview_len = 200  # Limit preview length
            
            if len(content_preview) > max_preview_len * 2:
                # Show beginning and end
                logger.info("Content Preview:")
                logger.info(f"START: {content_preview[:max_preview_len]}...")
                logger.info(f"END: ...{content_preview[-max_preview_len:]}")
            else:
                logger.info(f"Content: {content_preview}")
                
            # Log boundary information - what type of blocks are at the boundaries
            if i > 0:
                prev_last_block = refined_chunks[i-1][-1]
                curr_first_block = chunk_data[0]
                logger.info(f"Boundary: {prev_last_block['block_type']} → {curr_first_block['block_type']}")
            
            logger.info("-" * 40)