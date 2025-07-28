# tests/test_llm_service_real_api.py
import pytest
import pytest_asyncio
import os
from typing import List

from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.domain.document.entities.block import Block


# Skip these tests if no API key is available
pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("OPENAI_API_KEY"),
        reason="OPENAI_API_KEY not set"
    ),
    pytest.mark.slow
]


class TestOpenAILLMRealAPI:
    """Integration tests that actually call the OpenAI API"""
    
    @pytest.mark.asyncio
    async def test_real_streaming_response(self):
        """Test actual streaming response from OpenAI API"""
        llm = OpenAILLM(model="gpt-4o-mini")
        
        messages = [
            Message(role=Role.SYSTEM, content="You are a helpful assistant. Be concise."),
            Message(role=Role.USER, content="What is 2+2? Answer in one word.")
        ]
        
        chunks = []
        async for chunk in llm.generate_response_stream(messages):
            chunks.append(chunk)
            print(f"Chunk: '{chunk}'", end="", flush=True)
        
        print()  # New line after streaming
        
        full_response = "".join(chunks)
        assert len(full_response) > 0
        assert "4" in full_response or "four" in full_response.lower()
    
    @pytest.mark.asyncio
    async def test_real_structured_response(self):
        """Test actual structured response from OpenAI API"""
        llm = OpenAILLM(model="gpt-4o-mini")
        
        messages = [
            Message(
                role=Role.USER, 
                content="Analyze this sentence: 'The quick brown fox jumps over the lazy dog.' Return your analysis as JSON."
            )
        ]
        
        schema = {
            "type": "object",
            "properties": {
                "word_count": {"type": "integer"},
                "contains_all_letters": {"type": "boolean"},
                "sentiment": {
                    "type": "string",
                    "enum": ["positive", "negative", "neutral"]
                }
            },
            "required": ["word_count", "contains_all_letters", "sentiment"]
        }
        
        result = await llm.generate_structured_response(
            messages,
            response_format={"type": "json_object"},
            json_schema=schema
        )
        
        print(f"Structured response: {result}")
        
        assert isinstance(result, dict)
        assert "word_count" in result
        assert result["word_count"] == 9
        assert "contains_all_letters" in result
        assert result["contains_all_letters"] is True
        assert "sentiment" in result
        assert result["sentiment"] in ["positive", "negative", "neutral"]
    
    @pytest.mark.asyncio
    async def test_real_conversation_context(self):
        """Test that the model maintains conversation context"""
        llm = OpenAILLM(model="gpt-4o-mini")
        
        messages = [
            Message(role=Role.USER, content="My name is Alice. Remember it."),
            Message(role=Role.ASSISTANT, content="I'll remember that your name is Alice."),
            Message(role=Role.USER, content="What's my name?")
        ]
        
        response = await llm.generate_response(messages)
        print(f"Context response: {response}")
        
        assert "alice" in response.lower()


class TestLLMDocumentAnalyzerRealAPI:
    """Integration tests for document analyzer with real OpenAI API"""
    
    @pytest.mark.asyncio
    async def test_real_document_summary_generation(self):
        """Test actual document summary generation using OpenAI"""
        llm = OpenAILLM(model="gpt-4o-mini")
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Create a realistic document about Python programming
        blocks = [
            Block(
                id="1",
                document_id="doc1",
                html_content="<h1>Introduction to Python Programming</h1>",
                block_type="heading"
            ),
            Block(
                id="2",
                document_id="doc1",
                html_content="<p>Python is a high-level, interpreted programming language known for its simplicity and readability. It was created by Guido van Rossum and first released in 1991.</p>",
                block_type="paragraph"
            ),
            Block(
                id="3",
                document_id="doc1",
                html_content="<h2>Key Features</h2>",
                block_type="heading"
            ),
            Block(
                id="4",
                document_id="doc1",
                html_content="<ul><li>Simple and easy to learn syntax</li><li>Extensive standard library</li><li>Cross-platform compatibility</li><li>Strong community support</li></ul>",
                block_type="list"
            ),
            Block(
                id="5",
                document_id="doc1",
                html_content="<h2>Common Use Cases</h2>",
                block_type="heading"
            ),
            Block(
                id="6",
                document_id="doc1",
                html_content="<p>Python is widely used in web development, data science, artificial intelligence, automation, and scientific computing. Popular frameworks include Django, Flask, NumPy, and TensorFlow.</p>",
                block_type="paragraph"
            )
        ]
        
        summary = await analyzer.generate_document_summary(blocks, "Python Programming Guide")
        print(f"\nGenerated summary:\n{summary}\n")
        
        # Verify the summary contains relevant information
        assert len(summary) > 100
        assert "python" in summary.lower()
        assert any(word in summary.lower() for word in ["programming", "language", "development"])
    
    @pytest.mark.asyncio
    async def test_real_technical_document_summary(self):
        """Test summary generation for a technical document"""
        llm = OpenAILLM(model="gpt-4o-mini")
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Create a technical document about REST APIs
        blocks = [
            Block(
                id="1",
                document_id="doc2",
                html_content="<h1>RESTful API Design Best Practices</h1>",
                block_type="heading"
            ),
            Block(
                id="2",
                document_id="doc2",
                html_content="<p>REST (Representational State Transfer) is an architectural style for designing networked applications. It relies on stateless, client-server communication.</p>",
                block_type="paragraph"
            ),
            Block(
                id="3",
                document_id="doc2",
                html_content="<h2>HTTP Methods</h2>",
                block_type="heading"
            ),
            Block(
                id="4",
                document_id="doc2",
                html_content="<p>RESTful APIs use standard HTTP methods: GET for retrieving resources, POST for creating new resources, PUT for updating existing resources, DELETE for removing resources, and PATCH for partial updates.</p>",
                block_type="paragraph"
            ),
            Block(
                id="5",
                document_id="doc2",
                html_content="<h2>Status Codes</h2>",
                block_type="heading"
            ),
            Block(
                id="6",
                document_id="doc2",
                html_content="<p>Proper use of HTTP status codes is crucial: 200 for success, 201 for created, 404 for not found, 400 for bad request, and 500 for server errors.</p>",
                block_type="paragraph"
            )
        ]
        
        summary = await analyzer.generate_document_summary(blocks, "REST API Design Guide")
        print(f"\nTechnical document summary:\n{summary}\n")
        
        # Verify technical accuracy
        assert len(summary) > 100
        assert any(term in summary.lower() for term in ["rest", "api", "http"])
    
    @pytest.mark.asyncio
    async def test_real_edge_cases(self):
        """Test edge cases with real API"""
        llm = OpenAILLM(model="gpt-4o-mini")
        analyzer = LLMDocumentAnalyzer(llm)
        
        # Test with minimal content
        minimal_blocks = [
            Block(
                id="1",
                document_id="doc3",
                html_content="<p>Short content.</p>",
                block_type="paragraph"
            )
        ]
        
        summary = await analyzer.generate_document_summary(minimal_blocks, "Minimal Document")
        print(f"\nMinimal content summary:\n{summary}\n")
        
        assert len(summary) > 0
        assert summary != "Summary not available for 'Minimal Document'"