# new_backend_ruminate/context/builder.py

from __future__ import annotations
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.context.registry import renderer_registry, ensure_default

class ContextBuilder:
    async def build(
        self,
        conv: Conversation,
        thread: List[Message],
        *,
        session: AsyncSession,
    ) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        for msg in thread:
            key = f"{conv.type.lower()}.{msg.role.value.lower()}"
            ensure_default(key)
            txt = await renderer_registry[key](msg, conv, session=session)
            out.append({"role": msg.role.value, "content": txt})
        return out
