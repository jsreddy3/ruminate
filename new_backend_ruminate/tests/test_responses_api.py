"""Integration and unit tests for OpenAI *Responses* REST API

This suite is a drop‑in replacement for the previous `tests/test_responses_api.py` but
removes the OpenAI Python SDK dependency entirely.  All calls go directly to the
`/v1/responses` endpoint with plain HTTP via **httpx**.  The helper
`create_response()` wraps the low‑level HTTP plumbing so tests remain very close
in shape to the original versions (same method names, variable names, and
assertions where possible).

Key differences
---------------
* **HTTP only** – no `openai.AsyncOpenAI` import.
* **Web search enabled** – `tools=[{"type": "web_search_preview"}]` is included
  in the appropriate tests.
* **Streaming** – when `stream=True` we open an SSE connection and yield
  `StreamingEvent` objects whose `.delta` attribute matches the SDK’s streaming
  interface, so the calling code stays the same.
* **Conversation state** – pass an *array* of messages (dictionaries of
  `role`/`content`) as the `input` field, mirroring conversational examples in
  the docs.

To keep the public API nearly identical to the SDK, `create_response()` returns
either a `Response` dataclass (with `.output_text`) or an async generator that
yields `StreamingEvent` instances.  The tests therefore remain almost unchanged
except for the import paths.
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
import pytest
import pytest_asyncio
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Environment & constants
# ---------------------------------------------------------------------------

# Load the project‑root .env (same logic as the original test suite)
ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(ENV_PATH, override=True)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
RESPONSES_ENDPOINT = f"{BASE_URL}/responses"

DEFAULT_HEADERS = {
    "Authorization": f"Bearer {OPENAI_API_KEY}",
    "Content-Type": "application/json",
    # The Responses API is generally GA, but some previews may still require
    # a beta header.  Add it defensively so caller can flip behaviour via env.
    **({"OpenAI-Beta": os.getenv("OPENAI_BETA_HEADER", "")} if os.getenv("OPENAI_BETA_HEADER") else {}),
}


# ---------------------------------------------------------------------------
# Lightweight client helpers
# ---------------------------------------------------------------------------

@dataclass
class Response:
    """Mimics the SDK response object returned by `client.responses.create`."""

    output: List[Dict[str, Any]]
    raw: Dict[str, Any]
    
    @property
    def output_text(self):
        """Extract text from the response structure"""
        if isinstance(self.output, list) and len(self.output) > 0:
            # Look for the message in the output (could be after web_search_call)
            for item in self.output:
                if item.get('type') == 'message' and 'content' in item:
                    content_items = item['content']
                    if len(content_items) > 0 and 'text' in content_items[0]:
                        return content_items[0]['text']
            
            # Fallback: if it's a simple message structure
            message = self.output[0]
            if 'content' in message and len(message['content']) > 0:
                content = message['content'][0]
                if 'text' in content:
                    return content['text']
        return str(self.output)


@dataclass
class StreamingEvent:
    """Matches the shape used by the SDK when `stream=True`."""

    delta: str


async def _post_json(
    payload: Dict[str, Any], *, stream: bool = False, timeout: Optional[float] = None
) -> Any:
    """Low‑level helper that POSTs to /responses.

    If *stream* is True an *async generator* is returned that yields
    ``StreamingEvent`` objects parsed from the SSE stream.  Otherwise the full
    JSON is returned.
    """
    
    # Default to 30 seconds if no timeout specified
    if timeout is None:
        timeout = 30.0
    
    print(f"\n[DEBUG] Posting to: {RESPONSES_ENDPOINT}")
    print(f"[DEBUG] Headers: {dict((k, v[:50] + '...' if len(v) > 50 else v) for k, v in DEFAULT_HEADERS.items())}")
    print(f"[DEBUG] Payload: {json.dumps(payload, indent=2)}")
    print(f"[DEBUG] Timeout: {timeout}s")

    async with httpx.AsyncClient(timeout=timeout) as client:
        if stream:
            # SSE chunked response
            async with client.stream(
                "POST", RESPONSES_ENDPOINT, headers=DEFAULT_HEADERS, json=payload
            ) as resp:
                resp.raise_for_status()

                async def _aiter() -> AsyncGenerator[StreamingEvent, None]:
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            # ignore keep‑alives etc.
                            continue
                        data_str = line.removeprefix("data: ").strip()
                        if data_str == "[DONE]":
                            break
                        data = json.loads(data_str)
                        # The Responses API mirrors Chat Completions chunk shape
                        delta = (
                            data.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            yield StreamingEvent(delta)

                return _aiter()
        else:
            try:
                resp = await client.post(
                    RESPONSES_ENDPOINT, headers=DEFAULT_HEADERS, json=payload
                )
                print(f"[DEBUG] Response status: {resp.status_code}")
                print(f"[DEBUG] Response headers: {dict(resp.headers)}")
                
                if resp.status_code != 200:
                    print(f"[DEBUG] Response body: {resp.text}")
                    
                resp.raise_for_status()
                result = resp.json()
                print(f"[DEBUG] Response JSON: {json.dumps(result, indent=2)}")
                return result
            except Exception as e:
                print(f"[ERROR] Request failed: {type(e).__name__}: {e}")
                raise


async def create_response(
    *,
    model: str,
    input: Any,
    tools: Optional[List[Dict[str, Any]]] = None,
    stream: bool = False,
    **params: Any,
):
    """High‑level convenience wrapper mirroring SDK signature.

    Returns a ``Response`` when *stream* is **False**; otherwise an async
    generator of ``StreamingEvent``.
    """

    payload: Dict[str, Any] = {
        "model": model,
        "input": input,
        **params,
    }
    if tools is not None:
        payload["tools"] = tools

    result = await _post_json(payload, stream=stream)
    if stream:
        # Async generator directly
        return result

    # Non‑streaming: wrap in Response dataclass for convenient attr access
    return Response(output=result["output"], raw=result)


# =============================================================================
#                               TEST SUITE
# =============================================================================

class TestOpenAIResponsesAPI:
    """Integration tests for the *Responses* REST API (live calls)."""

    @pytest.mark.asyncio
    async def test_api_key_check(self):
        """Verify the API key follows project‑scoped pattern."""
        key_start = OPENAI_API_KEY[:20]
        print(f"\nUsing API key: {key_start}... (first 20 chars)")
        assert OPENAI_API_KEY.startswith("sk-proj-"), "Wrong API key pattern"

    @pytest.mark.asyncio
    async def test_responses_api_basic_text(self):
        """Plain text generation without tools."""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")

        res = await create_response(
            model="gpt-4o-mini",
            input="Write a one-sentence story about a robot.",
        )
        print(f"Basic response: {res.output_text}")
        assert "robot" in res.output_text.lower()

    @pytest.mark.asyncio
    async def test_responses_api_with_web_search(self):
        """Generation with the *web_search_preview* tool enabled."""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")

        res = await create_response(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input="What are the latest developments in quantum computing as of 2025? Please search for recent news.",
        )
        print(f"Web search response: {res.output_text}")
        lower = res.output_text.lower()
        assert any(term in lower for term in ("quantum", "computing", "qubit"))

    @pytest.mark.asyncio
    async def test_responses_api_streaming(self):
        """Verify streaming yields delta chunks incrementally."""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")

        stream = await create_response(
            model="gpt-4o-mini",
            input="Count from 1 to 5.",
            stream=True,
        )

        chunks: List[str] = []
        async for event in stream:  # type: ignore[func-returns-value]
            chunks.append(event.delta)
            print(event.delta, end="", flush=True)
        print()

        full_response = "".join(chunks)
        for num in ("1", "2", "3", "4", "5"):
            assert num in full_response

    @pytest.mark.asyncio
    async def test_responses_api_conversation_state(self):
        """Ensure the API can continue a conversation when given prior turns."""
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")

        history = [
            {"role": "user", "content": "My favorite color is blue."},
            {
                "role": "assistant",
                "content": "I'll remember that your favorite color is blue.",
            },
            {"role": "user", "content": "What's my favorite color?"},
        ]

        res = await create_response(model="gpt-4o-mini", input=history)
        print(f"State response: {res.output_text}")
        assert "blue" in res.output_text.lower()


# ---------------------------------------------------------------------------
#                Mocked unit tests (no live API calls required)
# ---------------------------------------------------------------------------

class TestResponsesAPIMocked:
    """Pure unit tests using `unittest.mock` to simulate API behaviour."""

    @pytest.mark.asyncio
    async def test_mocked_web_search_response(self, monkeypatch):
        mock_output = ("Based on my web search, the latest quantum computing "
                       "developments in 2025 include: 1) IBM announced a 1000‑qubit "
                       "processor, 2) Google achieved new error correction milestones, "
                       "3) Several startups demonstrated practical quantum applications "
                       "in drug discovery.")

        async def _fake_create_response(**kwargs):  # noqa: D401
            return Response(output_text=mock_output, raw={})

        monkeypatch.setattr(
            __name__,  # patch within this module
            "create_response",
            _fake_create_response,
        )

        res = await create_response(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input="What are the latest developments in quantum computing?",
        )

        assert "quantum" in res.output_text.lower()
        assert "2025" in res.output_text

    @pytest.mark.asyncio
    async def test_mocked_streaming_response(self, monkeypatch):
        """Simulate streaming by yielding predefined chunks."""

        async def _fake_stream(**kwargs):
            async def _aiter():
                for chunk in ["Hello", " ", "world", "!"]:
                    yield StreamingEvent(delta=chunk)
            return _aiter()

        monkeypatch.setattr(__name__, "create_response", _fake_stream)

        stream = await create_response(
            model="gpt-4o-mini", input="Say hello", stream=True
        )
        chunks: List[str] = []
        async for event in stream:  # type: ignore[func-returns-value]
            chunks.append(event.delta)
        assert "".join(chunks) == "Hello world!"


# ---------------------------------------------------------------------------
#                 Comparison between Chat & Responses APIs
# ---------------------------------------------------------------------------

class TestResponsesAPIComparison:
    """Compares Chat Completions and Responses endpoints side‑by‑side."""

    @pytest.mark.asyncio
    async def test_compare_apis_basic(self):
        if not OPENAI_API_KEY:
            pytest.skip("OPENAI_API_KEY not set")

        # --- Chat Completions via OpenAI SDK (still handy for parity checks) ---
        try:
            from openai import AsyncOpenAI  # Import lazily; optional in project
        except ImportError:
            pytest.skip("openai SDK not installed – comparison test skipped")

        chat_client = AsyncOpenAI()
        chat_resp = await chat_client.chat.completions.create(
            model="gpt-4o-mini", messages=[{"role": "user", "content": "What is 2+2?"}]
        )
        chat_answer = chat_resp.choices[0].message.content

        # --- Responses API direct call ---
        res = await create_response(model="gpt-4o-mini", input="What is 2+2?")
        responses_answer = res.output_text

        print(f"Chat API: {chat_answer}")
        print(f"Responses API: {responses_answer}")

        assert any(tok in chat_answer for tok in ("4", "four"))
        assert any(tok in responses_answer for tok in ("4", "four"))
