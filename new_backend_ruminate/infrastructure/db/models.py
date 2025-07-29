"""
Import all models to ensure they're registered with SQLAlchemy metadata.
This file is imported by test fixtures and bootstrap to ensure all tables are created.
"""

# Import conversation models (these use Base from meta.py)
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.entities.message import Message

# Import document models
from new_backend_ruminate.infrastructure.document.models import DocumentModel, PageModel, BlockModel

# Import user models
from new_backend_ruminate.infrastructure.user.models import UserModel

__all__ = [
    'Conversation',
    'Message',
    'DocumentModel',
    'PageModel',
    'BlockModel',
    'UserModel'
]