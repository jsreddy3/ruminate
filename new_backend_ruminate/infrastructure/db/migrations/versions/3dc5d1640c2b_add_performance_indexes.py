"""add_performance_indexes

Revision ID: 3dc5d1640c2b
Revises: 9e8568e7f8b5
Create Date: 2025-08-03 17:08:06.305572

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3dc5d1640c2b'
down_revision: Union[str, None] = '9e8568e7f8b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Documents table indexes
    op.create_index('idx_documents_status', 'documents', ['status'])
    op.create_index('idx_documents_user_created', 'documents', ['user_id', 'created_at'])
    
    # Blocks table indexes  
    op.create_index('idx_blocks_document_page', 'blocks', ['document_id', 'page_number'])
    
    # Pages table indexes
    op.create_index('idx_pages_document_page', 'pages', ['document_id', 'page_number'])
    
    # Conversations table indexes
    op.create_index('idx_conversations_document_type', 'conversations', ['document_id', 'type'])
    op.create_index('idx_conversations_source_block_type', 'conversations', ['source_block_id', 'type'])
    
    # Messages table indexes
    op.create_index('idx_messages_created_at', 'messages', ['created_at'])
    op.create_index('idx_messages_conversation_created', 'messages', ['conversation_id', 'created_at'])


def downgrade() -> None:
    # Drop indexes in reverse order
    op.drop_index('idx_messages_conversation_created', 'messages')
    op.drop_index('idx_messages_created_at', 'messages')
    op.drop_index('idx_conversations_source_block_type', 'conversations')
    op.drop_index('idx_conversations_document_type', 'conversations')
    op.drop_index('idx_pages_document_page', 'pages')
    op.drop_index('idx_blocks_document_page', 'blocks')
    op.drop_index('idx_documents_user_created', 'documents')
    op.drop_index('idx_documents_status', 'documents')
