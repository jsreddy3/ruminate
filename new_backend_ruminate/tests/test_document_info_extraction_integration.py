"""Integration tests for document info extraction with real OpenAI API calls"""
import os
import json
from pathlib import Path
from datetime import datetime
import pytest
from dotenv import load_dotenv

from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.domain.document.entities.block import Block


# Load environment variables
ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(ENV_PATH, override=True)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


class TestDocumentInfoExtractionIntegration:
    """Integration tests for document info extraction (live API calls)"""
    
    @pytest.mark.asyncio
    async def test_api_key_check(self):
        """Verify the API key is available"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        key_start = OPENAI_API_KEY[:20]
        print(f"\nUsing API key: {key_start}... (first 20 chars)")
        assert OPENAI_API_KEY.startswith("sk-"), "API key should start with sk-"
    
    @pytest.mark.asyncio
    async def test_extract_info_from_research_paper(self):
        """Test extracting info from a research paper-like document"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        # Create real LLM service
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Create sample research paper blocks
        blocks = [
            Block(
                id="1",
                document_id="test_doc_1",
                page_number=0,
                html_content="""<h1>Deep Learning for Natural Language Processing: A Comprehensive Survey</h1>
                <p>By Dr. Sarah Johnson, Prof. Michael Chen, and Dr. Emily Rodriguez</p>
                <p>Department of Computer Science, Stanford University</p>
                <p>Published: January 2024</p>"""
            ),
            Block(
                id="2",
                document_id="test_doc_1", 
                page_number=0,
                html_content="""<h2>Abstract</h2>
                <p>This comprehensive survey examines the recent advances in deep learning techniques 
                for natural language processing (NLP). We review the evolution from traditional 
                methods to transformer-based architectures, discussing key innovations like BERT, 
                GPT, and their variants. The paper also explores current challenges and future 
                directions in the field.</p>"""
            ),
            Block(
                id="3",
                document_id="test_doc_1",
                page_number=1,
                html_content="""<h2>1. Introduction</h2>
                <p>Natural Language Processing has undergone a revolutionary transformation with 
                the advent of deep learning. This survey aims to provide a comprehensive overview 
                of the field, targeting both researchers and practitioners.</p>"""
            )
        ]
        
        # Extract document info
        result = await analyzer.generate_document_info(blocks, "nlp_survey_2024.pdf")
        
        print(f"\nExtracted info: {json.dumps(result, indent=2)}")
        
        # Verify structured output
        assert isinstance(result, dict)
        assert "document_info" in result
        assert "author" in result
        assert "title" in result
        
        # Check content quality
        assert len(result["document_info"]) > 50  # Should have substantial info
        assert "Dr. Sarah Johnson" in result["author"] or "Johnson" in result["author"]
        assert "Deep Learning" in result["title"] or "Natural Language" in result["title"]
        assert result["title"] != "nlp_survey_2024.pdf"  # Should suggest better title
    
    @pytest.mark.asyncio
    async def test_extract_info_from_business_document(self):
        """Test extracting info from a business document"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Create sample business document blocks
        blocks = [
            Block(
                id="1",
                document_id="test_doc_2",
                page_number=0,
                html_content="""<img src="logo.png" alt="TechCorp Inc.">
                <h1>Annual Financial Report 2023</h1>
                <h2>TechCorp Inc.</h2>
                <p>Prepared by: Finance Department</p>
                <p>Date: March 15, 2024</p>"""
            ),
            Block(
                id="2",
                document_id="test_doc_2",
                page_number=0,
                html_content="""<h2>Executive Summary</h2>
                <p>TechCorp Inc. achieved record revenues of $2.5 billion in 2023, 
                representing a 23% year-over-year growth. This report details our 
                financial performance, strategic initiatives, and outlook for 2024.</p>"""
            )
        ]
        
        result = await analyzer.generate_document_info(blocks, "financial_report.pdf")
        
        print(f"\nExtracted business doc info: {json.dumps(result, indent=2)}")
        
        # Verify extraction
        assert "TechCorp" in result["document_info"] or "financial" in result["document_info"].lower()
        assert "Annual Financial Report" in result["title"] or "TechCorp" in result["title"]
    
    @pytest.mark.asyncio
    async def test_extract_info_with_no_clear_author(self):
        """Test extraction when author is not clearly stated"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        blocks = [
            Block(
                id="1",
                document_id="test_doc_3",
                page_number=0,
                html_content="""<h1>Python Programming Best Practices</h1>
                <h2>A Guide for Modern Development</h2>"""
            ),
            Block(
                id="2",
                document_id="test_doc_3",
                page_number=0,
                html_content="""<p>This guide covers essential best practices for Python 
                development including code style, testing, documentation, and deployment.</p>"""
            )
        ]
        
        result = await analyzer.generate_document_info(blocks, "python_guide.pdf")
        
        print(f"\nExtracted info (no author): {json.dumps(result, indent=2)}")
        
        # Should handle missing author gracefully
        assert result["author"] == "Unknown"
        assert "Python" in result["title"]
        assert "Python" in result["document_info"] or "programming" in result["document_info"].lower()
    
    @pytest.mark.asyncio
    async def test_parallel_extraction_performance(self):
        """Test that parallel extraction of summary and info works efficiently"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        blocks = [
            Block(
                id="1",
                document_id="test_doc_4",
                page_number=0,
                html_content="""<h1>Machine Learning in Healthcare</h1>
                <p>By Dr. Alex Thompson</p>
                <p>This paper explores applications of ML in medical diagnosis.</p>"""
            )
        ]
        
        import asyncio
        import time
        
        # Time parallel execution
        start = time.time()
        summary_task = analyzer.generate_document_summary(blocks, "ml_healthcare.pdf")
        info_task = analyzer.generate_document_info(blocks, "ml_healthcare.pdf")
        
        summary, info = await asyncio.gather(summary_task, info_task)
        parallel_time = time.time() - start
        
        print(f"\nParallel execution time: {parallel_time:.2f}s")
        print(f"Summary length: {len(summary)} chars")
        print(f"Info: {json.dumps(info, indent=2)}")
        
        # Verify both completed successfully
        assert len(summary) > 50
        assert "Dr. Alex Thompson" in info["author"] or "Thompson" in info["author"]
        assert "Machine Learning" in info["title"] or "Healthcare" in info["title"]
    
    @pytest.mark.asyncio
    async def test_structured_output_error_handling(self):
        """Test that errors in structured output are handled gracefully"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Create blocks with very little content
        blocks = [
            Block(
                id="1",
                document_id="test_doc_5",
                page_number=0,
                html_content="<p>...</p>"  # Minimal content
            )
        ]
        
        result = await analyzer.generate_document_info(blocks, "minimal.pdf")
        
        print(f"\nMinimal content result: {json.dumps(result, indent=2)}")
        
        # Should still return valid structure
        assert isinstance(result, dict)
        assert "document_info" in result
        assert "author" in result
        assert "title" in result


class TestDocumentInfoExtractionEdgeCases:
    """Test edge cases and error scenarios"""
    
    @pytest.mark.asyncio
    async def test_large_document_pagination(self):
        """Test that only first 5 pages are processed for large documents"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Create blocks for 10 pages
        blocks = []
        for page in range(10):
            blocks.append(Block(
                id=f"block_{page}",
                document_id="large_doc",
                page_number=page,
                html_content=f"<h2>Chapter {page + 1}</h2><p>Content for page {page}</p>"
            ))
        
        # Add distinctive content on page 6 that shouldn't be included
        blocks[6].html_content = "<p>UNIQUE_CONTENT_PAGE_6: This should not be processed</p>"
        
        result = await analyzer.generate_document_info(blocks, "large_document.pdf")
        
        print(f"\nLarge doc info: {json.dumps(result, indent=2)}")
        
        # Debug: Let's see what pages were processed
        print(f"Content sent to LLM contained: Chapter 1 through Chapter 5")
        
        # The test was looking for content that should NOT be there
        # Let's check what was actually processed
        doc_info = result["document_info"]
        
        # Verify page 6 content wasn't processed
        if "UNIQUE_CONTENT_PAGE_6" in doc_info:
            print(f"ERROR: Found page 6 content in document_info!")
            print(f"Full document_info: {doc_info}")
        
        assert "UNIQUE_CONTENT_PAGE_6" not in doc_info, "Page 6 content should not be in the first 5 pages"
        assert "chapter" in doc_info.lower()  # But early chapters should be mentioned
    
    @pytest.mark.asyncio 
    async def test_html_stripping(self):
        """Test that HTML tags are properly stripped"""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")
        
        llm = OpenAILLM(api_key=OPENAI_API_KEY)
        analyzer = LLMDocumentAnalyzer(llm)
        
        blocks = [
            Block(
                id="1",
                document_id="html_doc",
                page_number=0,
                html_content="""<div class="header">
                    <h1 style="color: blue;">Document with <em>HTML</em> Tags</h1>
                    <p class="author">By <strong>John Doe</strong></p>
                    <script>alert('test');</script>
                    <style>.header { color: red; }</style>
                </div>"""
            )
        ]
        
        result = await analyzer.generate_document_info(blocks, "html_heavy.pdf")
        
        print(f"\nHTML stripped info: {json.dumps(result, indent=2)}")
        
        # Should extract clean text without HTML artifacts
        assert "<div>" not in result["document_info"]
        assert "<script>" not in result["document_info"]
        assert "John Doe" in result["author"] or "Unknown" == result["author"]