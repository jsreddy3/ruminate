# tests/test_llm_service_integration.py
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import json
from typing import AsyncGenerator

from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.domain.document.entities.block import Block


@pytest.fixture
def mock_openai_response():
    """Fixture to create mock OpenAI responses"""
    def _create_response(content=None, tool_calls=None, stream=False):
        if stream:
            # Create mock streaming response
            chunks = []
            for word in (content or "").split():
                chunk = MagicMock()
                chunk.choices = [MagicMock()]
                chunk.choices[0].delta.content = word + " "
                chunks.append(chunk)
            return chunks
        else:
            # Create regular response
            mock_message = MagicMock()
            mock_message.content = content
            mock_message.tool_calls = tool_calls
            
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message = mock_message
            return mock_response
    
    return _create_response


class TestOpenAILLMIntegration:
    """Integration tests for OpenAILLM with mocked API"""
    
    @pytest.mark.asyncio
    async def test_complete_conversation_flow(self, mock_openai_response):
        """Test a complete conversation flow with streaming"""
        llm = OpenAILLM(api_key="test-key")
        
        # Mock streaming response
        mock_stream = AsyncMock()
        mock_stream.__aiter__.return_value = mock_openai_response(
            "Hello! I can help you with that.",
            stream=True
        )
        
        with patch.object(llm._client.chat.completions, 'create', AsyncMock(return_value=mock_stream)):
            messages = [
                Message(role=Role.SYSTEM, content="You are a helpful assistant"),
                Message(role=Role.USER, content="Can you help me?")
            ]
            
            # Test streaming
            chunks = []
            async for chunk in llm.generate_response_stream(messages):
                chunks.append(chunk)
            
            result = "".join(chunks)
            assert result == "Hello! I can help you with that. "
            
            # Verify API was called correctly
            llm._client.chat.completions.create.assert_called_once()
            call_args = llm._client.chat.completions.create.call_args
            assert call_args.kwargs["messages"] == [
                {"role": "system", "content": "You are a helpful assistant"},
                {"role": "user", "content": "Can you help me?"}
            ]
            assert call_args.kwargs["stream"] is True
    
    @pytest.mark.asyncio
    async def test_structured_response_with_schema_validation(self, mock_openai_response):
        """Test structured response with complex schema"""
        llm = OpenAILLM(api_key="test-key")
        
        # Mock tool call response
        mock_tool_call = MagicMock()
        mock_tool_call.function.arguments = json.dumps({
            "summary": "This is a test summary",
            "key_points": ["point1", "point2"],
            "sentiment": "positive"
        })
        
        mock_response = mock_openai_response(tool_calls=[mock_tool_call])
        
        with patch.object(llm._client.chat.completions, 'create', AsyncMock(return_value=mock_response)):
            messages = [
                Message(role=Role.USER, content="Analyze this text")
            ]
            
            schema = {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "key_points": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "sentiment": {
                        "type": "string",
                        "enum": ["positive", "negative", "neutral"]
                    }
                },
                "required": ["summary", "key_points", "sentiment"]
            }
            
            result = await llm.generate_structured_response(
                messages,
                response_format={"type": "json_object"},
                json_schema=schema
            )
            
            assert result["summary"] == "This is a test summary"
            assert result["key_points"] == ["point1", "point2"]
            assert result["sentiment"] == "positive"
    
    @pytest.mark.asyncio
    async def test_error_handling_in_stream(self):
        """Test error handling during streaming"""
        llm = OpenAILLM(api_key="test-key")
        
        # Create a mock stream that yields one item then raises an error
        class ErrorStream:
            def __init__(self):
                self.count = 0
            
            def __aiter__(self):
                return self
            
            async def __anext__(self):
                if self.count == 0:
                    self.count += 1
                    chunk = MagicMock()
                    chunk.choices = [MagicMock()]
                    chunk.choices[0].delta.content = "Start "
                    return chunk
                else:
                    raise Exception("API Error")
        
        with patch.object(llm._client.chat.completions, 'create', AsyncMock(return_value=ErrorStream())):
            messages = [Message(role=Role.USER, content="Test")]
            
            chunks = []
            with pytest.raises(Exception, match="API Error"):
                async for chunk in llm.generate_response_stream(messages):
                    chunks.append(chunk)
            
            # Should have collected the first chunk before error
            assert chunks == ["Start "]
    
    @pytest.mark.asyncio
    async def test_multiple_model_support(self, mock_openai_response):
        """Test using different models"""
        for model in ["gpt-4", "gpt-3.5-turbo", "gpt-4o-mini"]:
            llm = OpenAILLM(api_key="test-key", model=model)
            
            mock_response = mock_openai_response("Test response")
            
            with patch.object(llm._client.chat.completions, 'create', AsyncMock(return_value=mock_response)):
                messages = [Message(role=Role.USER, content="Test")]
                
                result = await llm.generate_structured_response(
                    messages,
                    response_format={"type": "json_object"}
                )
                
                # Verify correct model was used
                call_args = llm._client.chat.completions.create.call_args
                assert call_args.kwargs["model"] == model


class TestLLMDocumentAnalyzerIntegration:
    """Integration tests for document analyzer with LLM"""
    
    @pytest.mark.asyncio
    async def test_document_summary_generation_flow(self):
        """Test complete document summary generation flow"""
        # Create a mock LLM that returns realistic summaries
        mock_llm = AsyncMock()
        mock_llm.generate_response.return_value = """
        This document provides a comprehensive overview of machine learning fundamentals. 
        It covers supervised and unsupervised learning algorithms, including decision trees, 
        neural networks, and clustering techniques. The document also discusses practical 
        applications in natural language processing and computer vision, with examples 
        from real-world implementations.
        
        Key sections include data preprocessing techniques, model evaluation metrics, 
        and strategies for handling overfitting. The document emphasizes the importance 
        of feature engineering and provides code examples in Python using popular 
        libraries like scikit-learn and TensorFlow.
        """
        
        analyzer = LLMDocumentAnalyzer(mock_llm)
        
        # Create realistic document blocks
        blocks = [
            Block(
                id="1",
                document_id="doc1",
                html_content="<h1>Introduction to Machine Learning</h1>",
                block_type="heading"
            ),
            Block(
                id="2",
                document_id="doc1",
                html_content="<p>Machine learning is a subset of <strong>artificial intelligence</strong> that focuses on building systems that learn from data.</p>",
                block_type="paragraph"
            ),
            Block(
                id="3",
                document_id="doc1",
                html_content="<h2>Supervised Learning</h2>",
                block_type="heading"
            ),
            Block(
                id="4",
                document_id="doc1",
                html_content="<p>In supervised learning, we train models on labeled data. Common algorithms include:</p><ul><li>Decision Trees</li><li>Random Forests</li><li>Neural Networks</li></ul>",
                block_type="paragraph"
            )
        ]
        
        summary = await analyzer.generate_document_summary(blocks, "ML Fundamentals Guide")
        
        # Verify the summary was generated
        assert "machine learning" in summary.lower()
        assert "supervised" in summary.lower()
        assert len(summary) > 100
        
        # Verify the LLM was called with properly formatted content
        mock_llm.generate_response.assert_called_once()
        call_args = mock_llm.generate_response.call_args
        messages = call_args[0][0]
        
        # Check system message
        assert messages[0]["role"] == "system"
        assert "summarizer" in messages[0]["content"]
        
        # Check user message contains document content
        user_message = messages[1]["content"]
        assert "ML Fundamentals Guide" in user_message
        assert "Introduction to Machine Learning" in user_message
        assert "Supervised Learning" in user_message
        assert "Decision Trees" in user_message
    
    @pytest.mark.asyncio
    async def test_large_document_handling(self):
        """Test handling of large documents with many blocks"""
        mock_llm = AsyncMock()
        mock_llm.generate_response.return_value = "Summary of large document with multiple chapters and sections."
        
        analyzer = LLMDocumentAnalyzer(mock_llm)
        
        # Create many blocks
        blocks = []
        for i in range(50):
            blocks.append(Block(
                id=f"block_{i}",
                document_id="doc1",
                html_content=f"<p>This is paragraph {i} with some content about topic {i % 5}.</p>",
                block_type="paragraph"
            ))
        
        summary = await analyzer.generate_document_summary(blocks, "Large Document")
        
        assert summary is not None
        assert len(summary) > 0
        
        # Verify all blocks were processed
        call_args = mock_llm.generate_response.call_args
        user_message = call_args[0][0][1]["content"]
        
        # Check that content from various blocks is included
        assert "paragraph 0" in user_message
        assert "paragraph 49" in user_message
    
    @pytest.mark.asyncio
    async def test_html_content_cleanup(self):
        """Test that HTML is properly cleaned before sending to LLM"""
        mock_llm = AsyncMock()
        mock_llm.generate_response.return_value = "Summary of cleaned content"
        
        analyzer = LLMDocumentAnalyzer(mock_llm)
        
        # Create blocks with complex HTML
        blocks = [
            Block(
                id="1",
                document_id="doc1",
                html_content="""
                <div class="content">
                    <h1 style="color: red;">Main Title</h1>
                    <p>This is <em>emphasized</em> and <strong>bold</strong> text.</p>
                    <a href="https://example.com">Link text</a>
                    <img src="image.jpg" alt="Description">
                    <script>alert('test')</script>
                    <style>body { color: blue; }</style>
                </div>
                """,
                block_type="mixed"
            )
        ]
        
        await analyzer.generate_document_summary(blocks, "HTML Test")
        
        # Check that HTML was stripped from the content sent to LLM
        call_args = mock_llm.generate_response.call_args
        user_message = call_args[0][0][1]["content"]
        
        # HTML tags should be removed
        assert "<div" not in user_message
        assert "<h1" not in user_message
        assert "<script>" not in user_message
        
        # But text content should remain
        assert "Main Title" in user_message
        assert "emphasized" in user_message
        assert "bold" in user_message
        assert "Link text" in user_message
    
    @pytest.mark.asyncio
    async def test_empty_and_invalid_content_handling(self):
        """Test handling of empty or invalid content"""
        mock_llm = AsyncMock()
        analyzer = LLMDocumentAnalyzer(mock_llm)
        
        # Test with empty blocks
        summary = await analyzer.generate_document_summary([], "Empty Doc")
        assert summary == "Summary not available for 'Empty Doc'"
        mock_llm.generate_response.assert_not_called()
        
        # Test with blocks that have no content
        blocks_no_content = [
            Block(id="1", document_id="doc1", html_content="", block_type="empty"),
            Block(id="2", document_id="doc1", html_content=None, block_type="null"),
            Block(id="3", document_id="doc1", html_content="   ", block_type="whitespace")
        ]
        
        summary = await analyzer.generate_document_summary(blocks_no_content, "No Content Doc")
        assert summary == "Summary not available for 'No Content Doc'"