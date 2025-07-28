"""add_user_id_indexes_for_auth_performance

Revision ID: a473eeaffa31
Revises: 91d7a3fe7050
Create Date: 2025-07-28 12:47:03.200347

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a473eeaffa31'
down_revision: Union[str, None] = '91d7a3fe7050'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add indexes for efficient user-scoped queries
    op.create_index('ix_conversations_user_id', 'conversations', ['user_id'])
    op.create_index('ix_documents_user_id', 'documents', ['user_id'])
    op.create_index('ix_messages_user_id', 'messages', ['user_id'])
    
    # Composite index for efficient conversation + user validation
    op.create_index('ix_messages_conversation_user', 'messages', ['conversation_id', 'user_id'])


def downgrade() -> None:
    # Remove indexes in reverse order
    op.drop_index('ix_messages_conversation_user', table_name='messages')
    op.drop_index('ix_messages_user_id', table_name='messages')
    op.drop_index('ix_documents_user_id', table_name='documents')
    op.drop_index('ix_conversations_user_id', table_name='conversations')
