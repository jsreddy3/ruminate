from __future__ import annotations
import json
import os
from typing import Any, AsyncGenerator, Dict, List, Union
import httpx

from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.ports.llm import LLMService


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

        print(f"[DEBUG] Sending request to {self._base_url}")
        print(f"[DEBUG] Payload: {json.dumps(payload, indent=2)}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST", self._base_url, headers=self._headers, json=payload
            ) as resp:
                print(f"[DEBUG] Response status: {resp.status_code}")
                resp.raise_for_status()
                
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    
                    data_str = line.removeprefix("data: ").strip()
                    if data_str == "[DONE]":
                        break
                    
                    try:
                        data = json.loads(data_str)
                        # The Responses API streaming format might be different
                        # Let's check what we're getting
                        print(f"[DEBUG] Stream chunk: {json.dumps(data)[:200]}...")
                        
                        # Try different paths for content
                        if "choices" in data:
                            delta = (
                                data.get("choices", [{}])[0]
                                .get("delta", {})
                                .get("content", "")
                            )
                        elif "delta" in data:
                            delta = data.get("delta", {}).get("content", "")
                        else:
                            # Maybe it's a different structure
                            delta = ""
                            
                        if delta:
                            yield delta
                    except json.JSONDecodeError as e:
                        print(f"[DEBUG] JSON decode error: {e}")

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