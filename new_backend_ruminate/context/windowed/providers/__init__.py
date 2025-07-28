# new_backend_ruminate/context/windowed/providers/__init__.py

from .system_prompt import SystemPromptProvider
from .document_summary import DocumentSummaryProvider
from .page_range import PageRangeProvider
from .conversation_history import ConversationHistoryProvider

__all__ = [
    "SystemPromptProvider",
    "DocumentSummaryProvider", 
    "PageRangeProvider",
    "ConversationHistoryProvider"
]