#!/usr/bin/env python3
"""
Quick and dirty test for document metadata extraction.
Just raw SQL to get blocks, then feed to GPT-4o-mini.
"""

import asyncio
import json
import os
import asyncpg
from typing import Dict, Any, List
from dotenv import load_dotenv
from pathlib import Path
import httpx

# Load .env file from parent directory, override system env vars
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path, override=True)

from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM


async def get_document_text(document_id: str) -> tuple[str, str]:
    """Get text from first 2 pages using raw SQL"""
    
    # Get DB connection from env
    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ruminate")
    
    conn = await asyncpg.connect(db_url)
    try:
        # Get document title
        doc = await conn.fetchrow(
            "SELECT title FROM documents WHERE id = $1",
            document_id
        )
        if not doc:
            raise ValueError(f"Document {document_id} not found")
        
        title = doc['title']
        
        # Get blocks from first 2 pages
        blocks = await conn.fetch("""
            SELECT html_content, page_number, block_type 
            FROM blocks 
            WHERE document_id = $1 AND page_number < 2
            ORDER BY page_number, id
        """, document_id)
        
        # Extract text
        text_parts = []
        for block in blocks:
            if block['html_content']:
                # Strip HTML tags
                import re
                clean_text = re.sub('<.*?>', '', block['html_content'])
                if clean_text.strip():
                    text_parts.append(clean_text.strip())
        
        text = "\n\n".join(text_parts)
        
        print(f"📄 Document: {title}")
        print(f"📊 Found {len(blocks)} blocks from first 2 pages")
        print(f"📝 Extracted {len(text)} characters")
        
        return text, title
        
    finally:
        await conn.close()


async def search_parallel(text: str, max_results: int = 5) -> List[Dict]:
    """Search using Parallel Search API based on document text"""
    
    api_key = os.environ.get("PARALLEL_API_KEY")
    if not api_key:
        print("⚠️  No Parallel Search API key found, skipping web search")
        return []
    
    # Generate search queries from document text
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    # Debug: Show what we're working with
    print(f"\n📝 First 10 lines of extracted text:")
    for i, line in enumerate(lines[:10], 1):
        print(f"   {i}: {line[:80]}{'...' if len(line) > 80 else ''}")
    
    # Better query generation strategy
    search_queries = []
    
    # Find the most substantial lines (likely title, authors, or key content)
    meaningful_lines = []
    for line in lines[:20]:  # Look at first 20 lines
        # Skip short lines (page numbers, etc.) and very long lines (paragraphs)
        if 30 < len(line) < 250:
            # Skip lines that are just numbers or dates
            if not line.replace(',', '').replace('.', '').replace(' ', '').isdigit():
                meaningful_lines.append(line)
    
    # Query 1: Most likely title (first meaningful line)
    if meaningful_lines:
        potential_title = meaningful_lines[0]
        # Clean up common academic formatting
        potential_title = potential_title.replace('*', '').strip()
        search_queries.append(f'"{potential_title}"')  # Exact match search
    
    # Query 2: Look for author names or unique identifiers
    author_query = None
    for line in meaningful_lines[1:5]:  # Check lines after title
        # Look for patterns that suggest authors
        if any(char.isupper() for char in line) and ',' in line:
            author_query = line[:150]
            break
        elif '@' in line or 'University' in line or 'Institute' in line:
            author_query = line[:150]
            break
    
    if author_query:
        search_queries.append(author_query)
    elif len(meaningful_lines) > 1:
        # Fallback: use second meaningful line
        search_queries.append(meaningful_lines[1][:150])
    
    # Create a better objective
    if meaningful_lines:
        objective = f"Find information about this academic document or publication: {meaningful_lines[0][:150]}"
    else:
        objective = f"Identify this document from its content: {' '.join(lines[:3])[:200]}"
    
    print(f"🔍 Searching with Parallel API...")
    print(f"   Objective: {objective[:200]}")
    print(f"   Full queries being sent:")
    for i, q in enumerate(search_queries[:2], 1):
        print(f"   Query {i}: {q}")
    
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "objective": objective,
        "search_queries": search_queries[:2],  # Max 2 queries for now
        "processor": "base",  # Fast processor
        "max_results": max_results,
        "max_chars_per_result": 1500
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.parallel.ai/alpha/search",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            print(f"   ✅ Found {len(results)} results")
            return results
    except Exception as e:
        print(f"   ❌ Search error: {e}")
        return []


async def extract_metadata(text: str, search_results: List[Dict] = None) -> Dict[str, Any]:
    """Extract metadata using GPT-4o-mini with document text and search results"""
    
    # Use OPENAI_API_KEY from .env 
    api_key = os.environ.get("OPENAI_API_KEY")
    print(f"🔑 Using OpenAI API key: ...{api_key[-4:] if api_key else 'None'}")
    llm = OpenAILLM(api_key=api_key, model="gpt-4o-mini")
    
    # Format search results for prompt
    search_context = ""
    if search_results:
        search_context = "\n\nWEB SEARCH RESULTS:\n"
        for i, result in enumerate(search_results[:3], 1):
            search_context += f"\n{i}. {result.get('title', 'Unknown')}\n"
            search_context += f"   URL: {result.get('url', '')}\n"
            excerpts = result.get('excerpts', [])
            if excerpts:
                search_context += f"   Excerpt: {' '.join(excerpts[:3])[:500]}...\n"
    
    prompt = f"""Analyze this document text and web search results to extract metadata.

DOCUMENT TEXT (first 2 pages):
{text[:3000]}
{search_context}

Based on the document content and any additional context from web search, extract and return as JSON:
- title: The exact document title
- author: Author(s) name(s)
- publication_date: Publication date
- document_type: Type (book, paper, article, report, etc.)
- subject: Main subject/topic
- summary: 2-3 sentence summary
- keywords: 3-5 key terms
- confidence: 0-1 confidence score

The web search results may provide additional context about the document, its authors, or publication details.
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
    
    return await llm.generate_structured_response(
        messages=messages,
        response_format={"type": "json_object"},
        json_schema=json_schema
    )


async def list_recent_documents():
    """List recent documents from DB"""
    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ruminate")
    
    conn = await asyncpg.connect(db_url)
    try:
        docs = await conn.fetch("""
            SELECT id, title, status, created_at 
            FROM documents 
            ORDER BY created_at DESC 
            LIMIT 10
        """)
        
        print("\n📚 Recent documents:")
        for i, doc in enumerate(docs, 1):
            status = "✅" if doc['status'] == "READY" else "⏳"
            print(f"{i}. {status} {doc['title'][:50]}...")
            print(f"   Full ID: {doc['id']}")
        
        return [doc['id'] for doc in docs]
    finally:
        await conn.close()


async def main():
    """Main entry point"""
    import sys
    
    # Get document ID
    if len(sys.argv) > 1:
        document_id = sys.argv[1]
    else:
        doc_ids = await list_recent_documents()
        if not doc_ids:
            print("❌ No documents found")
            return
            
        choice = input("\nEnter number (1-10) or full document ID: ").strip()
        
        if choice.isdigit() and 1 <= int(choice) <= len(doc_ids):
            document_id = doc_ids[int(choice) - 1]
        else:
            document_id = choice
    
    print(f"\n{'='*60}")
    print(f"🔍 Processing Document ID: {document_id}")
    print(f"{'='*60}\n")
    
    try:
        # Get text from DB
        text, title = await get_document_text(document_id)
        
        # Search with Parallel API
        search_results = await search_parallel(text)
        
        # Extract metadata with both document text and search results
        print("\n🤖 Extracting metadata with GPT-4o-mini...")
        metadata = await extract_metadata(text, search_results)
        
        # Display results
        print(f"\n{'='*60}")
        print("📊 EXTRACTED METADATA")
        print(f"{'='*60}")
        print(f"DB Title:   {title}")
        print(f"Extracted:  {metadata.get('title', 'N/A')}")
        print(f"Author:     {metadata.get('author', 'N/A')}")
        print(f"Date:       {metadata.get('publication_date', 'N/A')}")
        print(f"Type:       {metadata.get('document_type', 'N/A')}")
        print(f"Subject:    {metadata.get('subject', 'N/A')}")
        print(f"Keywords:   {', '.join(metadata.get('keywords', []) or [])}")
        print(f"Confidence: {metadata.get('confidence', 0):.2%}")
        print(f"\nSummary: {metadata.get('summary', 'N/A')}")
        
        # Save results
        output_file = f"metadata_{document_id[:8]}.json"
        with open(output_file, 'w') as f:
            json.dump({
                "document_id": document_id,
                "db_title": title,
                "extracted_metadata": metadata,
                "text_sample": text[:500],
                "search_results_used": len(search_results) if search_results else 0,
                "search_results_sample": search_results[:2] if search_results else []
            }, f, indent=2)
        print(f"\n💾 Results saved to {output_file}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())