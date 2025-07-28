from typing import Dict
from new_backend_ruminate.context.protocols import Retriever, Renderer
from new_backend_ruminate.context.renderers.default import plain_renderer
from new_backend_ruminate.context.renderers.rabbithole import (
    rabbithole_system_renderer,
    rabbithole_user_renderer,
    rabbithole_assistant_renderer,
    rabbithole_tool_renderer
)

retriever_registry: Dict[str, Retriever] = {}
renderer_registry:  Dict[str, Renderer]  = {
    # Register rabbithole renderers
    "rabbithole.system": rabbithole_system_renderer,
    "rabbithole.user": rabbithole_user_renderer,
    "rabbithole.assistant": rabbithole_assistant_renderer,
    "rabbithole.tool": rabbithole_tool_renderer,
}

def register_retriever(tag: str, retriever: Retriever) -> None:
    retriever_registry[tag] = retriever

def register_renderer(key: str, renderer: Renderer) -> None:
    renderer_registry[key] = renderer

def ensure_default(key: str) -> None:
    if key not in renderer_registry:
        renderer_registry[key] = plain_renderer
