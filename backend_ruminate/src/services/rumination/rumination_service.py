# services/rumination/rumination_service.py
from typing import Tuple, List, Dict, Optional
from src.models.base.document import Document
from src.models.viewer.block import Block
from src.models.viewer.page import Page
from src.services.ai.llm_service import LLMService
from src.models.insight import Insight, InsightType
import yaml
import json
import re

class RuminationService:
    """Service for generating insights from text."""
    
    def __init__(self, llm_service: LLMService, logger: Optional[EvaluationLogger] = None):
        self.llm = llm_service
        self.logger = logger or EvaluationLogger()
        self.prompts = self._load_prompts()
    
    def _load_prompts(self) -> Dict[str, str]:
        """Load base prompts from YAML"""
        with open('src/services/ai/prompts/base_prompts.yaml') as f:
            return yaml.safe_load(f)
    
    def find_unique_substring(self, content: str, source_text: str) -> Tuple[Optional[int], Optional[int]]:
        """Find the character positions of a substring match within source text."""
        if not content or not source_text:
            return None, None
            
        # Normalize whitespace and case for comparison
        normalized_content = re.sub(r'\s+', ' ', content.strip()).lower()
        normalized_source = re.sub(r'\s+', ' ', source_text).lower()
        
        # If normalized content isn't in normalized source, no match possible
        if normalized_content not in normalized_source:
            return None, None
            
        # Now try exact matching with original case
        matches = list(re.finditer(re.escape(content.strip()), source_text))
        
        if matches:  # Return first exact match if any exist
            match = matches[0]
            return match.start(), match.end()
        
        # If no exact match, try case-insensitive matching
        matches = list(re.finditer(re.escape(content.strip()), source_text, re.IGNORECASE))
        
        if matches:
            match = matches[0]
            return match.start(), match.end()
            
        return None, None

    def find_indices(self, content: str, source_text: str) -> Dict[str, Optional[int]]:
        """Find start and end indices for content within source text"""
        start, end = self.find_unique_substring(content, source_text)
        return {
            "start_index": start,
            "end_index": end
        }

    async def extract_metaphors(self, excerpt: str) -> List[Insight]:
        """Extract metaphorical insights from text"""
        if not excerpt:
            return []
            
        self.logger.log(f"\n🔍 Analyzing excerpt for metaphors:\n{excerpt[:200]}...")
        
        messages = [
            {"role": "system", "content": self.prompts['metaphor_analysis']['system']},
            {"role": "user", "content": f"Analyze this excerpt for metaphors: {excerpt}"}
        ]
        
        try:
            response = await self.llm.generate_response(messages)
            return self._parse_metaphor_insights(response['content'], excerpt)
        except Exception as e:
            self.logger.log(f"❌ Error during metaphor extraction: {str(e)}")
            return []
        
    async def extract_key_concepts(self, excerpt: str) -> List[Insight]:
        """Extract key concept insights from text"""
        if not excerpt:
            return []
            
        messages = [
            {"role": "system", "content": self.prompts['concept_analysis']['system']},
            {"role": "user", "content": f"Analyze this excerpt for key concepts: {excerpt}"}
        ]
        
        try:
            response = await self.llm.generate_response(messages)
            return self._parse_concept_insights(response['content'], excerpt)
        except Exception as e:
            self.logger.log(f"❌ Error during concept extraction: {str(e)}")
            return []
        
    def _parse_metaphor_insights(self, content: str, source_text: str) -> List[Insight]:
        """Parse LLM response into metaphor insights"""
        try:
            metaphors = json.loads(content)
            return [
                Insight(
                    type=InsightType.METAPHOR,
                    content=m["explanation"],
                    source_text=m["quote"],
                    **self.find_indices(m["quote"], source_text)
                )
                for m in metaphors
            ]
        except json.JSONDecodeError as e:
            self.logger.log(f"Failed to parse metaphor response: {e}")
            return []
            
    def _parse_concept_insights(self, content: str, source_text: str) -> List[Insight]:
        """Parse LLM response into concept insights"""
        try:
            concepts = json.loads(content)
            return [
                Insight(
                    type=InsightType.CONCEPT,
                    content=c["explanation"],
                    source_text=c["quote"],
                    **self.find_indices(c["quote"], source_text)
                )
                for c in concepts
            ]
        except json.JSONDecodeError as e:
            self.logger.log(f"Failed to parse concept response: {e}")
            return []
        
    async def split_document(self, blocks: List[Block]) -> Tuple[List[dict], List[dict]]:
        """Split a document into chunks and excerpts for processing.
        
        Args:
            blocks: List of blocks to split
            
        Returns:
            Tuple containing:
                - List of chunk dictionaries
                - List of excerpt dictionaries
            
        Raises:
            Exception: If splitting fails
        """
        raise NotImplementedError
    
    async def process_document(self, document: Document) -> None:
        """Process a document's chunks and excerpts to generate ruminations.
        
        Args:
            document: Document to process
            
        Raises:
            Exception: If processing fails
        """
        chunks, excerpts = await self.split_document(document.blocks)
        
        for chunk, excerpt in zip(chunks, excerpts):
            # Extract insights using LLM service
            result = await self.llm.extract_insights(
                excerpt=excerpt["text"],
                context=chunk["text"]
            )
            
            # Store rumination in database
            await self.db.store_rumination(
                document_id=document.id,
                excerpt_id=excerpt["id"],
                insights=result["insights"],
                metadata={
                    "cost": result["cost"],
                    "token_usage": result["usage"]
                }
            )
    
    async def get_ruminations(self, document_id: str) -> List[dict]:
        """Retrieve all ruminations for a document.
        
        Args:
            document_id: ID of the document
            
        Returns:
            List of rumination dictionaries
            
        Raises:
            Exception: If retrieval fails
        """
        raise NotImplementedError
    
    async def delete_ruminations(self, document_id: str) -> None:
        """Delete all ruminations for a document.
        
        Args:
            document_id: ID of the document
            
        Raises:
            Exception: If deletion fails
        """
        raise NotImplementedError

    async def analyze_block(self, block: Block) -> List[Insight]:
        """Analyze a single block and generate insights"""
        if not block.html_content:
            return []
            
        # First do meta-analysis to determine which tools to use
        messages = [
            {"role": "system", "content": self.prompts['meta_analysis']['system']},
            {"role": "user", "content": f"Analyze this text and recommend tools: {block.html_content}"}
        ]
        
        try:
            response = await self.llm.generate_response(messages)
            meta_analysis = json.loads(response['content'])
            
            insights = []
            for tool in meta_analysis["recommended_tools"]:
                if tool == "extract_metaphors":
                    insights.extend(await self.extract_metaphors(block.html_content))
                elif tool == "extract_key_concepts":
                    insights.extend(await self.extract_key_concepts(block.html_content))
                # ... handle other tools ...
            
            return insights
            
        except Exception as e:
            self.logger.log(f"❌ Error analyzing block: {str(e)}")
            return []