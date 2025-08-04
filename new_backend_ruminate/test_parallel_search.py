"""
Test script for experimenting with Parallel Search API for PDF document identification.
This is an isolated test to figure out the best search strategies and prompts.
"""

import asyncio
import json
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import httpx
from pathlib import Path
import base64
import PyPDF2
import io

from infrastructure.llm.openai_llm import OpenAILLM


@dataclass
class DocumentInfo:
    """Structured output for document information"""
    title: Optional[str] = None
    author: Optional[str] = None
    publication_date: Optional[str] = None
    document_type: Optional[str] = None
    subject: Optional[str] = None
    summary: Optional[str] = None
    keywords: List[str] = None
    publisher: Optional[str] = None
    context: Optional[str] = None
    confidence_score: float = 0.0


class ParallelSearchService:
    """Service for testing Parallel Search API with PDFs"""
    
    def __init__(self, search_api_key: str = None, openai_api_key: str = None):
        self.search_api_key = search_api_key or os.environ.get("PARALLEL_SEARCH_API_KEY")
        self.openai_llm = OpenAILLM(api_key=openai_api_key, model="gpt-4o-mini")
        self.search_base_url = "https://api.parallelsearch.ai/v1"
        
    def extract_pdf_text(self, pdf_path: str, max_pages: int = 3) -> str:
        """Extract text from the first N pages of a PDF"""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            pages_to_read = min(max_pages, len(pdf_reader.pages))
            
            for page_num in range(pages_to_read):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n\n"
                
        return text.strip()
    
    async def search_parallel_api(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Call the Parallel Search API"""
        headers = {
            "Authorization": f"Bearer {self.search_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "query": query,
            "num_results": num_results,
            "search_type": "web"  # or "academic" for academic papers
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.search_base_url}/search",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    def generate_search_queries(self, pdf_text: str, strategy: str = "comprehensive") -> List[str]:
        """Generate search queries from PDF text using different strategies"""
        
        queries = []
        
        # Clean up the text
        lines = pdf_text.split('\n')
        cleaned_lines = [line.strip() for line in lines if line.strip()]
        
        if strategy == "comprehensive":
            # Strategy 1: Look for title-like text (usually at the beginning)
            if len(cleaned_lines) > 0:
                potential_title = cleaned_lines[0]
                if len(potential_title) > 10 and len(potential_title) < 200:
                    queries.append(f'"{potential_title}"')
            
            # Strategy 2: Look for author names (often after title)
            if len(cleaned_lines) > 1:
                for i in range(1, min(5, len(cleaned_lines))):
                    line = cleaned_lines[i]
                    # Simple heuristic: if line is short and contains capitals, might be author
                    if 10 < len(line) < 100 and any(c.isupper() for c in line):
                        queries.append(f'"{line}" author publication')
            
            # Strategy 3: Extract key phrases from first paragraph
            first_paragraph = " ".join(cleaned_lines[:10])[:500]
            if first_paragraph:
                queries.append(first_paragraph[:200])
                
        elif strategy == "minimal":
            # Just use the first meaningful line as a query
            if cleaned_lines:
                queries.append(cleaned_lines[0][:200])
                
        elif strategy == "academic":
            # For academic papers, look for abstract, DOI, journal info
            text_lower = pdf_text.lower()
            if "abstract" in text_lower:
                # Try to extract text after "abstract"
                abstract_idx = text_lower.index("abstract")
                abstract_text = pdf_text[abstract_idx:abstract_idx+500]
                queries.append(f"academic paper {abstract_text[:200]}")
            else:
                queries.append(f"academic paper {cleaned_lines[0][:200]}")
        
        return queries[:3]  # Limit to 3 queries max
    
    async def analyze_with_llm(self, pdf_text: str, search_results: List[Dict[str, Any]]) -> DocumentInfo:
        """Use GPT-4o-mini to analyze PDF text and search results"""
        
        # Prepare the prompt
        prompt = f"""Based on the following PDF text excerpt and web search results, extract structured information about this document.

PDF TEXT (first 3 pages):
{pdf_text[:3000]}

SEARCH RESULTS:
{json.dumps(search_results, indent=2)[:2000]}

Analyze the above and provide:
1. The exact title of the document
2. The author(s) name(s)
3. Publication date (if available)
4. Type of document (e.g., book, research paper, article, report)
5. Main subject/topic
6. Brief summary (2-3 sentences)
7. Key keywords (3-5 words)
8. Publisher (if available)
9. Any important context about this document
10. Confidence score (0-1) for how certain you are about the identification

Be as accurate as possible. If information is not available, indicate null."""

        messages = [
            {"role": "system", "content": "You are a document analysis expert. Extract accurate metadata from documents."},
            {"role": "user", "content": prompt}
        ]
        
        # Define the JSON schema for structured output
        json_schema = {
            "type": "object",
            "properties": {
                "title": {"type": ["string", "null"]},
                "author": {"type": ["string", "null"]},
                "publication_date": {"type": ["string", "null"]},
                "document_type": {"type": ["string", "null"]},
                "subject": {"type": ["string", "null"]},
                "summary": {"type": ["string", "null"]},
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "publisher": {"type": ["string", "null"]},
                "context": {"type": ["string", "null"]},
                "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["title", "confidence_score"]
        }
        
        result = await self.openai_llm.generate_structured_response(
            messages=messages,
            response_format={"type": "json_object"},
            json_schema=json_schema,
            model="gpt-4o-mini"
        )
        
        return DocumentInfo(**result)
    
    async def process_pdf(self, pdf_path: str, strategy: str = "comprehensive") -> DocumentInfo:
        """Main method to process a PDF and get document information"""
        
        print(f"\n{'='*50}")
        print(f"Processing PDF: {pdf_path}")
        print(f"Strategy: {strategy}")
        print(f"{'='*50}\n")
        
        # Step 1: Extract text from PDF
        print("Step 1: Extracting text from first 3 pages...")
        pdf_text = self.extract_pdf_text(pdf_path, max_pages=3)
        print(f"Extracted {len(pdf_text)} characters of text")
        
        # Step 2: Generate search queries
        print("\nStep 2: Generating search queries...")
        queries = self.generate_search_queries(pdf_text, strategy=strategy)
        for i, query in enumerate(queries, 1):
            print(f"  Query {i}: {query[:100]}...")
        
        # Step 3: Perform parallel searches
        print("\nStep 3: Performing web searches...")
        all_results = []
        for query in queries:
            try:
                results = await self.search_parallel_api(query, num_results=3)
                all_results.extend(results.get("results", []))
                print(f"  ✓ Found {len(results.get('results', []))} results for query")
            except Exception as e:
                print(f"  ✗ Error searching: {e}")
        
        # Step 4: Analyze with LLM
        print("\nStep 4: Analyzing with GPT-4o-mini...")
        doc_info = await self.analyze_with_llm(pdf_text, all_results)
        
        # Print results
        print("\n" + "="*50)
        print("DOCUMENT INFORMATION")
        print("="*50)
        print(f"Title: {doc_info.title}")
        print(f"Author: {doc_info.author}")
        print(f"Date: {doc_info.publication_date}")
        print(f"Type: {doc_info.document_type}")
        print(f"Subject: {doc_info.subject}")
        print(f"Keywords: {', '.join(doc_info.keywords or [])}")
        print(f"Publisher: {doc_info.publisher}")
        print(f"Confidence: {doc_info.confidence_score:.2f}")
        print(f"\nSummary: {doc_info.summary}")
        print(f"\nContext: {doc_info.context}")
        
        return doc_info


async def test_different_strategies():
    """Test different search strategies on sample PDFs"""
    
    service = ParallelSearchService()
    
    # Test PDFs
    test_pdfs = [
        "tests/test.pdf",
        "tests/test_sup.pdf"
    ]
    
    strategies = ["comprehensive", "minimal", "academic"]
    
    results = {}
    
    for pdf_path in test_pdfs:
        if not Path(pdf_path).exists():
            print(f"Skipping {pdf_path} - file not found")
            continue
            
        results[pdf_path] = {}
        
        for strategy in strategies:
            try:
                doc_info = await service.process_pdf(pdf_path, strategy=strategy)
                results[pdf_path][strategy] = doc_info
            except Exception as e:
                print(f"Error processing {pdf_path} with {strategy}: {e}")
                results[pdf_path][strategy] = None
    
    # Compare results
    print("\n" + "="*50)
    print("STRATEGY COMPARISON")
    print("="*50)
    
    for pdf_path, strategies_results in results.items():
        print(f"\n{pdf_path}:")
        for strategy, doc_info in strategies_results.items():
            if doc_info:
                print(f"  {strategy}: {doc_info.title} (confidence: {doc_info.confidence_score:.2f})")


async def main():
    """Main entry point for testing"""
    
    # Single PDF test
    service = ParallelSearchService()
    
    # You can test with a specific PDF
    pdf_path = "tests/test.pdf"
    if Path(pdf_path).exists():
        await service.process_pdf(pdf_path, strategy="comprehensive")
    
    # Uncomment to test different strategies
    # await test_different_strategies()


if __name__ == "__main__":
    asyncio.run(main())