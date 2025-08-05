from __future__ import annotations
import json
import os
import logging
from typing import Any, AsyncGenerator, Dict, List, Union
import httpx

from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.ports.llm import LLMService

# Set up dedicated logger for web search events (console only)
web_search_logger = logging.getLogger("web_search")
web_search_logger.setLevel(logging.INFO)

# Create console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Create formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)

# Add handler to logger
web_search_logger.addHandler(console_handler)


class OpenAIResponsesLLM(LLMService):
    """OpenAI Responses API implementation with web search support."""

    def __init__(self, api_key: str | None = None, model: str = "gpt-4o", enable_web_search: bool = True) -> None:
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self._model = model
        self._enable_web_search = enable_web_search
        self._base_url = "https://api.openai.com/v1/responses"
        self._headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def _normalise(
        self, msgs: List[Union[Message, Dict[str, str]]]
    ) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        for m in msgs:
            if isinstance(m, Message):
                out.append({"role": m.role.value, "content": m.content})
            else:
                out.append(m)
        return out

    def _extract_text_from_output(self, output: List[Dict[str, Any]]) -> str:
        """Extract text content from Responses API output structure."""
        for item in output:
            if item.get('type') == 'message' and 'content' in item:
                content_items = item['content']
                if len(content_items) > 0 and content_items[0].get('type') == 'output_text':
                    return content_items[0]['text']
        return ""

    async def generate_response_stream(
        self, messages: List[Message], model: str | None = None
    ) -> AsyncGenerator[str, None]:
        # Handle both Message objects and plain dicts
        if messages and hasattr(messages[0], 'role'):
            chat_msgs = await self._normalise(messages)
        else:
            chat_msgs = messages  # Already normalized
        
        payload: Dict[str, Any] = {
            "model": model or self._model,
            "input": chat_msgs,
            "stream": True,
        }
        
        if self._enable_web_search:
            payload["tools"] = [{"type": "web_search_preview"}]
            web_search_logger.info(f"Web search ENABLED for request")
        else:
            web_search_logger.info(f"Web search DISABLED for request")
            
        # Log the user's query
        if chat_msgs:
            last_user_msg = next((msg for msg in reversed(chat_msgs) if msg.get("role") == "user"), None)
            if last_user_msg:
                web_search_logger.info(f"User query: {last_user_msg.get('content', '')[:500]}...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST", self._base_url, headers=self._headers, json=payload
            ) as resp:
                resp.raise_for_status()
                
                web_search_performed = False
                web_search_query = None
                
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    
                    data_str = line.removeprefix("data: ").strip()
                    if data_str == "[DONE]":
                        break
                    
                    try:
                        data = json.loads(data_str)
                        
                        # Responses API uses event types
                        event_type = data.get("type", "")
                        
                        # Track web search events
                        if event_type == "response.web_search_call.in_progress":
                            web_search_performed = True
                            web_search_logger.info("Web search initiated")
                            # Yield a special event for the frontend
                            yield json.dumps({
                                "type": "tool_use",
                                "tool": "web_search",
                                "status": "starting"
                            })
                            
                        elif event_type == "response.output_item.added":
                            item = data.get("item", {})
                            if item.get("type") == "web_search_call":
                                action = item.get("action", {})
                                if action.get("type") == "search":
                                    web_search_query = action.get("query", "")
                                    web_search_logger.info(f"Web search query: '{web_search_query}'")
                                    # Yield search query event
                                    yield json.dumps({
                                        "type": "tool_use",
                                        "tool": "web_search",
                                        "status": "searching",
                                        "query": web_search_query
                                    })
                                    
                        elif event_type == "response.web_search_call.searching":
                            web_search_logger.info("Web search in progress...")
                            
                        elif event_type == "response.web_search_call.completed":
                            web_search_logger.info("Web search completed")
                            # Yield completion event
                            yield json.dumps({
                                "type": "tool_use",
                                "tool": "web_search",
                                "status": "completed"
                            })
                            
                        elif event_type == "response.output_item.done":
                            item = data.get("item", {})
                            if item.get("type") == "web_search_call" and item.get("status") == "completed":
                                action = item.get("action", {})
                                if not web_search_query and action.get("type") == "search":
                                    web_search_query = action.get("query", "")
                                    web_search_logger.info(f"Web search completed with query: '{web_search_query}'")
                        
                        # Yield text deltas
                        if event_type == "response.output_text.delta":
                            delta = data.get("delta", "")
                            if delta:
                                yield delta
                                
                    except json.JSONDecodeError as e:
                        web_search_logger.error(f"JSON decode error: {e}")
                    except Exception as e:
                        web_search_logger.error(f"Error processing chunk: {e}")
                
                # Log summary at the end
                if web_search_performed:
                    web_search_logger.info(f"Request completed WITH web search. Query: '{web_search_query or 'unknown'}'")
                else:
                    web_search_logger.info(f"Request completed WITHOUT web search")

    async def generate_structured_response(
        self,
        messages: List[Union[Message, Dict[str, str]]],
        *,
        response_format: Dict[str, Any],
        json_schema: Dict[str, Any] | None = None,
        model: str | None = None,
    ) -> Dict[str, Any]:
        # For now, just use regular generation and parse the response
        # The Responses API doesn't support structured output directly yet
        response = await self.generate_response(messages, model)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"error": "Failed to parse JSON response"}