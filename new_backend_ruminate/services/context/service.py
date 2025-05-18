# new_backend_ruminate/services/context/service.py

"""
Context-assembly engine.

A ContextBuilder turns the thin *event log* (Conversation + Message rows)
into the fully-hydrated list of `{role, content}` dicts that an LLM API
expects.  It does so in two stages:

1. Renderers map `(message.role, conversation.type, template_key)` to a
   string.  They may inspect `message.meta_data` to decide how to fetch
   supporting material, but they never modify persistence.

2. Retrievers are small, pluggable adaptors that resolve references
   recorded in `message.meta_data` (block_ids, memory_keys, dream_ids, …)
   into text snippets.  They are free to cache aggressively;

Registry look-ups are plain dictionaries so new products can register their
plugins at import time without touching this file.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Protocol

from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.conversation.entities.conversation import (
    Conversation,
)
from sqlalchemy.ext.asyncio import AsyncSession


# ───────────────────────────── retrievers ────────────────────────────── #

class Retriever(ABC):
    """Resolve a reference stored in message.meta_data into text."""

    @abstractmethod
    async def fetch(self, ref: Any, *, session: AsyncSession) -> str: ...


# global registry: tag → retriever instance
retriever_registry: Dict[str, Retriever] = {}


def register_retriever(tag: str, retriever: Retriever) -> None:
    retriever_registry[tag] = retriever


# ───────────────────────────── renderers ─────────────────────────────── #

class Renderer(Protocol):
    async def __call__(
        self,
        msg: Message,
        conv: Conversation,
        *,
        session: AsyncSession,
    ) -> str: ...


renderer_registry: Dict[str, Renderer] = {}


def register_renderer(key: str, renderer: Renderer) -> None:
    """
    Key scheme is free-form.  A simple practice is
        f"{conv.type}.{msg.role.lower()}"
    e.g. "chat.user", "dream.system".
    """
    renderer_registry[key] = renderer


# default renderer just returns msg.content untouched
async def _plain_renderer(
    msg: Message,
    conv: Conversation,
    *,
    session: AsyncSession,
) -> str:
    return msg.content


# register default for every role / type combination lazily
def _ensure_default(key: str) -> None:
    if key not in renderer_registry:
        renderer_registry[key] = _plain_renderer


# ───────────────────────────── builder ───────────────────────────────── #

class ContextBuilder:
    """
    Stateless builder.  Call .build() with an already-ordered thread
    (root → leaf) and receive a list ready for the LLM client.
    """

    async def build(
        self,
        conv: Conversation,
        thread: List[Message],
        *,
        session: AsyncSession,
    ) -> List[Dict[str, str]]:
        rendered: List[Dict[str, str]] = []

        for msg in thread:
            key = f"{conv.type.lower()}.{msg.role.value.lower()}"
            _ensure_default(key)
            txt = await renderer_registry[key](msg, conv, session=session)

            # honour OpenAI / Anthropic schema (`role`, `content`)
            rendered.append({"role": msg.role.value, "content": txt})

        return rendered


# ───────────────────────────── example plug-ins ──────────────────────── #
#
# These show how future products extend the system.  They would normally
# live in their own package and run register_*() at import time.

class InMemorySnippetRetriever(Retriever):
    def __init__(self, store: Dict[str, str]):
        self._store = store

    async def fetch(self, ref: str, *, session: AsyncSession) -> str:
        await asyncio.sleep(0)  # mimic network IO
        return self._store.get(ref, "")


async def _doc_user_renderer(
    msg: Message,
    conv: Conversation,
    *,
    session: AsyncSession,
) -> str:
    """
    Example renderer for a document chat user message:
       prepend block snippets before the user content.
    """
    parts: List[str] = []
    refs = msg.meta_data.get("doc_blocks", [])
    retriever = retriever_registry["doc_blocks"]
    for block_id in refs:
        parts.append(await retriever.fetch(block_id, session=session))
    parts.append(msg.content)
    return "\n".join(parts)


# --------------------------------------------------------------------- #
# Application start-up code (dependencies.py or similar) can do:        #
#                                                                       #
#   register_retriever("doc_blocks", InMemorySnippetRetriever(block_db))#
#   register_renderer("chat.user", _doc_user_renderer)                  #
#                                                                       #
# and every call to ContextBuilder will automatically enrich user turns #
# when it sees message.meta_data["doc_blocks"].                         #
# --------------------------------------------------------------------- #
