"""add_main_conversation_id_to_documents

Revision ID: a8ccfd79f9f5
Revises: 520c47dba994
Create Date: 2025-07-31 13:36:25.789912

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8ccfd79f9f5'
down_revision: Union[str, None] = '520c47dba994'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add main_conversation_id column to documents table
    op.add_column('documents', sa.Column('main_conversation_id', sa.String(), nullable=True))
    
    # Add foreign key constraint to conversations table
    op.create_foreign_key(
        'fk_documents_main_conversation_id',
        'documents', 'conversations',
        ['main_conversation_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_documents_main_conversation_id', 'documents', type_='foreignkey')
    
    # Drop the column
    op.drop_column('documents', 'main_conversation_id')
