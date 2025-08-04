# tests/test_responses_api.py
import pytest
import pytest_asyncio
import os
from typing import List
from unittest.mock import AsyncMock, patch, MagicMock
import json

from openai import AsyncOpenAI
from new_backend_ruminate.domain.conversation.entities.message import Message, Role


class TestOpenAIResponsesAPI:
    """Integration tests for OpenAI Responses API with web search"""
    
    @pytest.mark.asyncio
    async def test_responses_api_basic_text(self):
        """Test basic text generation with Responses API"""
        # Skip if no API key
        if not os.environ.get("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")
            
        client = AsyncOpenAI()
        
        try:
            response = await client.responses.create(
                model="gpt-4o-mini",
                input="Write a one-sentence story about a robot."
            )
            
            print(f"Basic response: {response.output_text}")
            
            assert hasattr(response, 'output_text')
            assert len(response.output_text) > 0
            assert "robot" in response.output_text.lower()
        except Exception as e:
            if "429" in str(e):
                pytest.skip("Rate limit hit")
            raise
    
    @pytest.mark.asyncio
    async def test_responses_api_with_web_search(self):
        """Test Responses API with web search tool"""
        # Skip if no API key
        if not os.environ.get("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")
            
        client = AsyncOpenAI()
        
        try:
            response = await client.responses.create(
                model="gpt-4o",
                tools=[{"type": "web_search_preview"}],
                input="What are the latest developments in quantum computing as of 2025? Please search for recent news.",
            )
            
            print(f"Web search response: {response.output_text}")
            
            assert hasattr(response, 'output_text')
            assert len(response.output_text) > 0
            # Should contain information about quantum computing
            assert any(term in response.output_text.lower() for term in ["quantum", "computing", "qubit"])
        except Exception as e:
            if "429" in str(e):
                pytest.skip("Rate limit hit")
            raise
    
    @pytest.mark.asyncio
    async def test_responses_api_streaming(self):
        """Test streaming with Responses API"""
        # Skip if no API key
        if not os.environ.get("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")
            
        client = AsyncOpenAI()
        
        try:
            stream = await client.responses.create(
                model="gpt-4o-mini",
                input="Count from 1 to 5.",
                stream=True,
            )
            
            chunks = []
            async for event in stream:
                if hasattr(event, 'delta'):
                    chunks.append(event.delta)
                    print(event.delta, end='', flush=True)
            
            print()  # New line after streaming
            
            full_response = "".join(chunks)
            assert len(full_response) > 0
            # Should contain numbers 1-5
            for num in ["1", "2", "3", "4", "5"]:
                assert num in full_response
        except Exception as e:
            if "429" in str(e):
                pytest.skip("Rate limit hit")
            raise
    
    @pytest.mark.asyncio
    async def test_responses_api_conversation_state(self):
        """Test conversation state management with Responses API"""
        # Skip if no API key
        if not os.environ.get("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")
            
        client = AsyncOpenAI()
        
        try:
            # Test with conversation history
            response = await client.responses.create(
                model="gpt-4o-mini",
                input=[
                    {"role": "user", "content": "My favorite color is blue."},
                    {"role": "assistant", "content": "I'll remember that your favorite color is blue."},
                    {"role": "user", "content": "What's my favorite color?"},
                ],
            )
            
            print(f"State response: {response.output_text}")
            
            assert hasattr(response, 'output_text')
            assert "blue" in response.output_text.lower()
        except Exception as e:
            if "429" in str(e):
                pytest.skip("Rate limit hit")
            raise


class TestResponsesAPIMocked:
    """Unit tests for Responses API with mocked responses"""
    
    @pytest.mark.asyncio
    async def test_mocked_web_search_response(self):
        """Test web search functionality with mocked API"""
        mock_response = MagicMock()
        mock_response.output_text = "Based on my web search, the latest quantum computing developments in 2025 include: 1) IBM announced a 1000-qubit processor, 2) Google achieved new error correction milestones, 3) Several startups demonstrated practical quantum applications in drug discovery."
        
        with patch('openai.AsyncOpenAI') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.responses.create = AsyncMock(return_value=mock_response)
            
            client = AsyncOpenAI()
            response = await client.responses.create(
                model="gpt-4o",
                tools=[{"type": "web_search_preview"}],
                input="What are the latest developments in quantum computing?",
            )
            
            # Verify the call was made correctly
            mock_client.responses.create.assert_called_once_with(
                model="gpt-4o",
                tools=[{"type": "web_search_preview"}],
                input="What are the latest developments in quantum computing?"
            )
            
            # Check response
            assert response.output_text
            assert "quantum" in response.output_text.lower()
            assert "2025" in response.output_text
    
    @pytest.mark.asyncio
    async def test_mocked_streaming_response(self):
        """Test streaming functionality with mocked API"""
        # Create mock stream events
        class MockEvent:
            def __init__(self, delta):
                self.delta = delta
        
        async def mock_stream():
            for chunk in ["Hello", " ", "world", "!"]:
                yield MockEvent(chunk)
        
        with patch('openai.AsyncOpenAI') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.responses.create = AsyncMock(return_value=mock_stream())
            
            client = AsyncOpenAI()
            stream = await client.responses.create(
                model="gpt-4o-mini",
                input="Say hello",
                stream=True,
            )
            
            chunks = []
            async for event in stream:
                chunks.append(event.delta)
            
            result = "".join(chunks)
            assert result == "Hello world!"


class TestResponsesAPIComparison:
    """Compare Chat Completions API with Responses API"""
    
    @pytest.mark.asyncio
    async def test_compare_apis_basic(self):
        """Compare basic functionality between APIs"""
        # Skip if no API key
        if not os.environ.get("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")
            
        client = AsyncOpenAI()
        
        try:
            # Chat Completions API
            chat_response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": "What is 2+2?"}
                ]
            )
            chat_result = chat_response.choices[0].message.content
            
            # Responses API
            responses_response = await client.responses.create(
                model="gpt-4o-mini",
                input="What is 2+2?"
            )
            responses_result = responses_response.output_text
            
            print(f"Chat API: {chat_result}")
            print(f"Responses API: {responses_result}")
            
            # Both should give correct answer
            assert "4" in chat_result or "four" in chat_result.lower()
            assert "4" in responses_result or "four" in responses_result.lower()
            
        except Exception as e:
            if "429" in str(e):
                pytest.skip("Rate limit hit")
            raise