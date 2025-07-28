# tests/test_llm_service.py
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import json
from typing import List, Dict, Any

from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.infrastructure.llm.echo_llm import EchoLLM
from new_backend_ruminate.domain.conversation.entities.message import Message, Role


class TestEchoLLM:
    """Unit tests for EchoLLM"""
    
    @pytest.mark.asyncio
    async def test_generate_response_stream_echoes_last_message(self):
        """Test that EchoLLM echoes the last message content"""
        llm = EchoLLM()
        messages = [
            Message(role=Role.USER, content="Hello world test message")
        ]
        
        chunks = []
        async for chunk in llm.generate_response_stream(messages):
            chunks.append(chunk)
        
        result = "".join(chunks)
        assert result == "Hello world test message "
    
    @pytest.mark.asyncio
    async def test_generate_response_stream_empty_messages(self):
        """Test EchoLLM with empty message list"""
        llm = EchoLLM()
        messages = []
        
        chunks = []
        async for chunk in llm.generate_response_stream(messages):
            chunks.append(chunk)
        
        result = "".join(chunks)
        assert result == "(empty) "
    
    @pytest.mark.asyncio
    async def test_generate_response_collects_stream(self):
        """Test that generate_response collects the stream properly"""
        llm = EchoLLM()
        messages = [
            Message(role=Role.USER, content="Test message")
        ]
        
        result = await llm.generate_response(messages)
        assert result == "Test message "
    
    @pytest.mark.asyncio
    async def test_generate_structured_response(self):
        """Test EchoLLM structured response"""
        llm = EchoLLM()
        messages = [Message(role=Role.USER, content="Test")]
        
        result = await llm.generate_structured_response(
            messages,
            response_format={"type": "json_object"}
        )
        
        assert result == {
            "thought": "echoing",
            "response_type": "answer", 
            "answer": "stub answer"
        }


class TestOpenAILLM:
    """Unit tests for OpenAILLM"""
    
    @pytest.mark.asyncio
    async def test_init_with_api_key(self):
        """Test OpenAILLM initialization with API key"""
        llm = OpenAILLM(api_key="test-key", model="gpt-4")
        assert llm._model == "gpt-4"
        assert llm._client.api_key == "test-key"
    
    @pytest.mark.asyncio
    async def test_init_from_env(self):
        """Test OpenAILLM initialization from environment"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'env-key'}):
            llm = OpenAILLM()
            assert llm._model == "gpt-4o"  # default model
    
    @pytest.mark.asyncio
    async def test_normalise_messages(self):
        """Test message normalization"""
        llm = OpenAILLM(api_key="test")
        
        messages = [
            Message(role=Role.USER, content="Hello"),
            {"role": "assistant", "content": "Hi"},
            Message(role=Role.SYSTEM, content="System prompt")
        ]
        
        normalized = await llm._normalise(messages)
        
        assert normalized == [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi"},
            {"role": "system", "content": "System prompt"}
        ]
    
    @pytest.mark.asyncio
    async def test_generate_response_stream(self):
        """Test streaming response generation"""
        llm = OpenAILLM(api_key="test")
        
        # Mock the OpenAI client
        mock_chunk = MagicMock()
        mock_chunk.choices = [MagicMock()]
        mock_chunk.choices[0].delta.content = "Test"
        
        mock_stream = AsyncMock()
        mock_stream.__aiter__.return_value = [mock_chunk]
        
        llm._client.chat.completions.create = AsyncMock(return_value=mock_stream)
        
        messages = [Message(role=Role.USER, content="Hello")]
        
        chunks = []
        async for chunk in llm.generate_response_stream(messages):
            chunks.append(chunk)
        
        assert chunks == ["Test"]
        llm._client.chat.completions.create.assert_called_once_with(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
            stream=True
        )
    
    @pytest.mark.asyncio
    async def test_generate_structured_response_with_tools(self):
        """Test structured response with function calling"""
        llm = OpenAILLM(api_key="test")
        
        # Mock response with tool call
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.arguments = '{"key": "value"}'
        mock_message.tool_calls = [mock_tool_call]
        mock_message.content = None
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = mock_message
        
        llm._client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        messages = [Message(role=Role.USER, content="Test")]
        json_schema = {
            "type": "object",
            "properties": {"key": {"type": "string"}}
        }
        
        result = await llm.generate_structured_response(
            messages,
            response_format={"type": "json_object"},
            json_schema=json_schema
        )
        
        assert result == {"key": "value"}
        
        # Verify the tools were set correctly
        call_args = llm._client.chat.completions.create.call_args
        assert call_args.kwargs["tools"] == [{
            "type": "function",
            "function": {
                "name": "output_structure",
                "description": "Return the answer in the mandated JSON form",
                "parameters": json_schema
            }
        }]
        assert call_args.kwargs["tool_choice"] == {
            "type": "function",
            "function": {"name": "output_structure"}
        }
    
    @pytest.mark.asyncio
    async def test_generate_structured_response_content_fallback(self):
        """Test structured response fallback to content parsing"""
        llm = OpenAILLM(api_key="test")
        
        # Mock response without tool calls
        mock_message = MagicMock()
        mock_message.tool_calls = None
        mock_message.content = '{"result": "test"}'
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = mock_message
        
        llm._client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        messages = [Message(role=Role.USER, content="Test")]
        
        result = await llm.generate_structured_response(
            messages,
            response_format={"type": "json_object"}
        )
        
        assert result == {"result": "test"}
    
    @pytest.mark.asyncio
    async def test_generate_structured_response_malformed_json(self):
        """Test handling of malformed JSON in tool calls"""
        llm = OpenAILLM(api_key="test")
        
        # Mock response with malformed JSON
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.arguments = 'not valid json'
        mock_message.tool_calls = [mock_tool_call]
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = mock_message
        
        llm._client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        messages = [Message(role=Role.USER, content="Test")]
        
        result = await llm.generate_structured_response(
            messages,
            response_format={"type": "json_object"}
        )
        
        assert result == {"error": "malformed JSON", "raw": "not valid json"}
    
    @pytest.mark.asyncio
    async def test_generate_structured_response_no_content(self):
        """Test handling when no structured data is returned"""
        llm = OpenAILLM(api_key="test")
        
        # Mock response with no useful content
        mock_message = MagicMock()
        mock_message.tool_calls = None
        mock_message.content = "Just plain text"
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = mock_message
        
        llm._client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        messages = [Message(role=Role.USER, content="Test")]
        
        result = await llm.generate_structured_response(
            messages,
            response_format={"type": "json_object"}
        )
        
        assert result == {"error": "no structured data", "raw": "Just plain text"}