#!/usr/bin/env python3
"""
Test document metadata extraction using existing documents in the database.
Takes a document ID and uses blocks from the first 2 pages as input.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from typing import Dict, List, Any, Optional
import httpx

from infrastructure.llm.openai_llm import OpenAILLM
from infrastructure.db.bootstrap import session_scope
from infrastructure.document.rds_document_repository import RDSDocumentRepository


class DocumentMetadataFromDB:
    """Extract metadata from documents already in the database"""
    
    def __init__(self, parallel_api_key: str = None):
        self.parallel_api_key = parallel_api_key or os.environ.get("PARALLEL_SEARCH_API_KEY")
        self.openai_llm = OpenAILLM(model="gpt-4o-mini")
        self.repo = RDSDocumentRepository()
        
    async def get_document_text(self, document_id: str, max_pages: int = 2) -> tuple[str, str]:
        """Get text from first N pages of a document"""
        async with session_scope() as session:
            # Get document info
            document = await self.repo.get_document(document_id, session)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            doc_title = document.title
            
            # Get blocks from first N pages
            all_blocks = await self.repo.get_blocks_by_document(document_id, session)
            
            # Filter to first N pages and sort
            blocks = [b for b in all_blocks if b.page_number < max_pages]
            blocks.sort(key=lambda b: (b.page_number, b.id))
            
            # Extract text
            text_parts = []
            for block in blocks:
                if block.html_content:
                    # Strip HTML tags
                    import re
                    clean_text = re.sub('<.*?>', '', block.html_content)
                    if clean_text.strip():
                        text_parts.append(clean_text.strip())
            
            full_text = "\n\n".join(text_parts)
            print(f"📄 Document: {doc_title}")
            print(f"📊 Extracted {len(blocks)} blocks from first {max_pages} pages")
            print(f"📝 Total text: {len(full_text)} characters")
            
            return full_text, doc_title
    
    async def search_parallel(self, query: str, num_results: int = 5) -> List[Dict]:
        """Search using Parallel Search API"""
        if not self.parallel_api_key:
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
            print(f"❌ Search error: {e}")
            return []
    
    def generate_search_queries(self, text: str) -> List[str]:
        """Generate search queries from document text"""
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        queries = []
        
        # Use first substantial line
        for line in lines[:5]:
            if 15 < len(line) < 200:
                queries.append(f'"{line}"')
                break
        
        # Use first paragraph
        if len(lines) > 3:
            first_para = " ".join(lines[:5])[:300]
            queries.append(first_para)
        
        return queries[:2]
    
    async def extract_metadata(self, text: str, search_results: List[Dict] = None) -> Dict[str, Any]:
        """Extract metadata using GPT-4o-mini"""
        
        prompt = f"""Analyze this document text and extract metadata.

DOCUMENT TEXT (first 2 pages):
{text[:3000]}

{f"WEB SEARCH RESULTS: {json.dumps(search_results, indent=2)[:1000]}" if search_results else ""}

Extract and return as JSON:
- title: Document title
- author: Author(s)
- publication_date: Publication date
- document_type: Type (book, paper, article, etc.)
- subject: Main subject
- summary: 2-3 sentence summary
- keywords: 3-5 key terms
- confidence: 0-1 confidence score

Use null for unavailable information."""

        messages = [
            {"role": "system", "content": "Extract document metadata. Return valid JSON only."},
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
                "keywords": {"type": ["array", "null"], "items": {"type": "string"}},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["confidence"]
        }
        
        return await self.openai_llm.generate_structured_response(
            messages=messages,
            response_format={"type": "json_object"},
            json_schema=json_schema
        )
    
    async def process_document(self, document_id: str, use_search: bool = True) -> Dict[str, Any]:
        """Process a document from the database"""
        
        print(f"\n{'='*60}")
        print(f"🔍 Processing Document ID: {document_id}")
        print(f"{'='*60}\n")
        
        # Get text from database
        text, doc_title = await self.get_document_text(document_id)
        
        # Optional: Search for more context
        search_results = []
        if use_search and self.parallel_api_key:
            print("\n🌐 Searching for additional context...")
            queries = self.generate_search_queries(text)
            for q in queries:
                print(f"   Query: {q[:80]}...")
                results = await self.search_parallel(q, num_results=3)
                search_results.extend(results)
            print(f"   Found {len(search_results)} total results")
        
        # Extract metadata
        print("\n🤖 Extracting metadata with GPT-4o-mini...")
        metadata = await self.extract_metadata(text, search_results if use_search else None)
        
        # Display results
        print(f"\n{'='*60}")
        print("📊 EXTRACTED METADATA")
        print(f"{'='*60}")
        print(f"DB Title:   {doc_title}")
        print(f"Extracted:  {metadata.get('title', 'N/A')}")
        print(f"Author:     {metadata.get('author', 'N/A')}")
        print(f"Date:       {metadata.get('publication_date', 'N/A')}")
        print(f"Type:       {metadata.get('document_type', 'N/A')}")
        print(f"Subject:    {metadata.get('subject', 'N/A')}")
        print(f"Keywords:   {', '.join(metadata.get('keywords', []) or [])}")
        print(f"Confidence: {metadata.get('confidence', 0):.2%}")
        print(f"\nSummary: {metadata.get('summary', 'N/A')}")
        
        return metadata


async def main():
    """Main entry point"""
    
    import sys
    from infrastructure.db.bootstrap import init_engine
    from config import settings
    
    # Initialize database
    await init_engine(settings())
    
    # Get document ID from command line or prompt
    if len(sys.argv) > 1:
        document_id = sys.argv[1]
    else:
        # List recent documents for user to choose
        async with session_scope() as session:
            repo = RDSDocumentRepository()
            from sqlalchemy import select
            from infrastructure.document.models import DocumentModel
            
            stmt = select(DocumentModel).order_by(DocumentModel.created_at.desc()).limit(10)
            result = await session.execute(stmt)
            recent_docs = result.scalars().all()
            
            if not recent_docs:
                print("❌ No documents found in database")
                return
            
            print("\n📚 Recent documents:")
            for i, doc in enumerate(recent_docs, 1):
                status = "✅" if doc.status == "READY" else "⏳"
                print(f"{i}. {status} {doc.title[:50]}... (ID: {doc.id[:8]}...)")
            
            choice = input("\nEnter number or full document ID: ").strip()
            
            if choice.isdigit() and 1 <= int(choice) <= len(recent_docs):
                document_id = recent_docs[int(choice) - 1].id
            else:
                document_id = choice
    
    # Process the document
    extractor = DocumentMetadataFromDB()
    
    # Check API keys
    has_parallel = bool(extractor.parallel_api_key)
    print(f"\n🔑 Parallel Search API: {'✅ Available' if has_parallel else '❌ Not configured (using LLM only)'}")
    
    try:
        # Run with search if available, otherwise LLM only
        metadata = await extractor.process_document(document_id, use_search=has_parallel)
        
        # Save results to file for review
        output_file = f"metadata_{document_id[:8]}.json"
        with open(output_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"\n💾 Results saved to {output_file}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())