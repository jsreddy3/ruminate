#!/usr/bin/env python3
"""
Test script to evaluate Parallel Search API + GPT-4o-mini for document identification
using Marker API outputs. This tests whether we can extract valuable metadata from PDFs.
"""

import asyncio
import json
import os
from typing import Dict, List, Any, Optional
from pathlib import Path
import httpx

from infrastructure.llm.openai_llm import OpenAILLM
from infrastructure.document_processing.marker_client import MarkerClient


class DocumentMetadataExtractor:
    """Extract document metadata using Parallel Search + GPT-4o-mini"""
    
    def __init__(self, parallel_api_key: str = None):
        self.parallel_api_key = parallel_api_key or os.environ.get("PARALLEL_SEARCH_API_KEY")
        self.openai_llm = OpenAILLM(model="gpt-4o-mini")
        self.marker_client = MarkerClient()
        
    async def search_parallel(self, query: str, num_results: int = 5) -> List[Dict]:
        """Search using Parallel Search API"""
        if not self.parallel_api_key:
            print("⚠️  No Parallel Search API key found, skipping web search")
            return []
            
        headers = {
            "Authorization": f"Bearer {self.parallel_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "query": query,
            "max_results": num_results
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.parallelsearch.ai/search",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get("results", [])
        except Exception as e:
            print(f"❌ Parallel Search error: {e}")
            return []
    
    def extract_text_from_marker_output(self, marker_pages: List[Dict], max_pages: int = 3) -> str:
        """Extract clean text from Marker API output"""
        text_parts = []
        
        for i, page in enumerate(marker_pages[:max_pages]):
            if "blocks" in page:
                for block in page["blocks"]:
                    if block.get("block_type") in ["Text", "Title", "Section-header"]:
                        if html_content := block.get("html"):
                            # Strip HTML tags
                            import re
                            clean_text = re.sub('<.*?>', '', html_content)
                            text_parts.append(clean_text.strip())
        
        return "\n\n".join(text_parts)
    
    def generate_search_queries(self, text: str) -> List[str]:
        """Generate effective search queries from document text"""
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        queries = []
        
        # Strategy 1: Use first substantial line (likely title)
        for line in lines[:5]:
            if 15 < len(line) < 200 and not line.startswith("Page"):
                queries.append(f'"{line}"')
                break
        
        # Strategy 2: Extract key phrases from first paragraph
        first_paragraph = " ".join(lines[:10])[:300]
        if first_paragraph:
            queries.append(first_paragraph)
        
        # Strategy 3: Look for author patterns
        for line in lines[:20]:
            if any(indicator in line.lower() for indicator in ["by ", "author", "@"]):
                queries.append(f'"{line}" publication')
                break
        
        return queries[:3]  # Max 3 queries
    
    async def extract_metadata_with_llm(
        self, 
        text: str, 
        search_results: List[Dict]
    ) -> Dict[str, Any]:
        """Use GPT-4o-mini to extract structured metadata"""
        
        prompt = f"""Analyze this document text and web search results to extract metadata.

DOCUMENT TEXT (first 3 pages):
{text[:2500]}

WEB SEARCH RESULTS:
{json.dumps(search_results, indent=2)[:1500] if search_results else "No search results available"}

Extract and return the following information as JSON:
- title: The exact title of the document
- author: Author name(s) 
- publication_date: When it was published
- document_type: Type (book, paper, article, report, etc.)
- subject: Main topic/subject area
- summary: 2-3 sentence summary
- keywords: 3-5 key terms
- publisher: Publisher if available
- confidence: Score 0-1 for identification confidence

If information is not available, use null."""

        messages = [
            {"role": "system", "content": "You are an expert at extracting document metadata. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ]
        
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
                    "type": ["array", "null"],
                    "items": {"type": "string"}
                },
                "publisher": {"type": ["string", "null"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["title", "confidence"]
        }
        
        result = await self.openai_llm.generate_structured_response(
            messages=messages,
            response_format={"type": "json_object"},
            json_schema=json_schema
        )
        
        return result
    
    async def process_pdf_with_marker(self, pdf_path: str) -> Dict[str, Any]:
        """Process a PDF using Marker API then extract metadata"""
        
        print(f"\n{'='*60}")
        print(f"📄 Processing: {pdf_path}")
        print(f"{'='*60}")
        
        # Step 1: Process with Marker API
        print("\n1️⃣  Processing with Marker API...")
        with open(pdf_path, 'rb') as f:
            file_content = f.read()
        
        marker_response = await self.marker_client.process_document(
            file_content, 
            Path(pdf_path).name
        )
        
        if marker_response.status == "error":
            print(f"❌ Marker API error: {marker_response.error}")
            return {"error": marker_response.error}
        
        if not marker_response.pages:
            print("❌ No pages returned from Marker")
            return {"error": "No pages in Marker output"}
        
        print(f"✅ Marker processed {len(marker_response.pages)} pages")
        
        # Step 2: Extract text from Marker output
        print("\n2️⃣  Extracting text from Marker output...")
        text = self.extract_text_from_marker_output(marker_response.pages)
        print(f"✅ Extracted {len(text)} characters of text")
        
        # Step 3: Generate search queries
        print("\n3️⃣  Generating search queries...")
        queries = self.generate_search_queries(text)
        for i, q in enumerate(queries, 1):
            print(f"   Query {i}: {q[:80]}...")
        
        # Step 4: Search with Parallel API
        print("\n4️⃣  Searching with Parallel API...")
        all_results = []
        for query in queries:
            results = await self.search_parallel(query, num_results=3)
            all_results.extend(results)
            if results:
                print(f"   ✅ Found {len(results)} results")
        
        # Step 5: Extract metadata with LLM
        print("\n5️⃣  Extracting metadata with GPT-4o-mini...")
        metadata = await self.extract_metadata_with_llm(text, all_results)
        
        # Display results
        print(f"\n{'='*60}")
        print("📊 EXTRACTED METADATA")
        print(f"{'='*60}")
        print(f"Title:      {metadata.get('title', 'N/A')}")
        print(f"Author:     {metadata.get('author', 'N/A')}")
        print(f"Date:       {metadata.get('publication_date', 'N/A')}")
        print(f"Type:       {metadata.get('document_type', 'N/A')}")
        print(f"Subject:    {metadata.get('subject', 'N/A')}")
        print(f"Publisher:  {metadata.get('publisher', 'N/A')}")
        print(f"Keywords:   {', '.join(metadata.get('keywords', []))}")
        print(f"Confidence: {metadata.get('confidence', 0):.2%}")
        print(f"\nSummary: {metadata.get('summary', 'N/A')}")
        
        return {
            "pdf_path": pdf_path,
            "metadata": metadata,
            "marker_pages": len(marker_response.pages),
            "text_extracted": len(text),
            "search_results_count": len(all_results)
        }


async def test_different_approaches():
    """Test different extraction approaches"""
    
    extractor = DocumentMetadataExtractor()
    
    # Test PDFs
    test_pdfs = [
        "tests/test.pdf",
        "tests/test_sup.pdf"
    ]
    
    results = []
    
    for pdf_path in test_pdfs:
        if not Path(pdf_path).exists():
            print(f"⚠️  Skipping {pdf_path} - file not found")
            continue
        
        try:
            result = await extractor.process_pdf_with_marker(pdf_path)
            results.append(result)
        except Exception as e:
            print(f"❌ Error processing {pdf_path}: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary comparison
    print(f"\n\n{'='*60}")
    print("📈 RESULTS SUMMARY")
    print(f"{'='*60}")
    
    for result in results:
        if "error" not in result:
            meta = result["metadata"]
            print(f"\n📄 {Path(result['pdf_path']).name}")
            print(f"   Title: {meta.get('title', 'N/A')}")
            print(f"   Confidence: {meta.get('confidence', 0):.2%}")
            print(f"   Search results used: {result['search_results_count']}")


async def quick_test():
    """Quick test with just LLM extraction (no search)"""
    
    print("\n🚀 QUICK TEST - Marker + LLM only (no web search)")
    
    extractor = DocumentMetadataExtractor()
    extractor.parallel_api_key = None  # Disable search for quick test
    
    pdf_path = "tests/test.pdf"
    if Path(pdf_path).exists():
        await extractor.process_pdf_with_marker(pdf_path)
    else:
        print(f"❌ Test PDF not found: {pdf_path}")


async def main():
    """Main entry point"""
    
    # Check for API keys
    has_parallel = bool(os.environ.get("PARALLEL_SEARCH_API_KEY"))
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    
    print("🔑 API Keys Status:")
    print(f"   OpenAI: {'✅' if has_openai else '❌'}")
    print(f"   Parallel Search: {'✅' if has_parallel else '❌ (will skip web search)'}")
    
    if not has_openai:
        print("\n❌ OpenAI API key required. Set OPENAI_API_KEY environment variable.")
        return
    
    # Run quick test first
    await quick_test()
    
    # Then run full test if Parallel API is available
    if has_parallel:
        print("\n\n🔍 FULL TEST - With Parallel Search API")
        await test_different_approaches()
    else:
        print("\n⚠️  Skipping full test (no Parallel Search API key)")


if __name__ == "__main__":
    asyncio.run(main())