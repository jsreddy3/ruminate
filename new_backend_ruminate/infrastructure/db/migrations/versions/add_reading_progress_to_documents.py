"""Add reading progress fields to documents table

Revision ID: add_reading_progress
Revises: aa0f8d748149
Create Date: 2025-01-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Note: postgresql import kept for potential future use with complex column types

# revision identifiers, used by Alembic.
revision: str = 'add_reading_progress'
down_revision: Union[str, None] = '75f897ce7d94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reading progress columns to documents table
    op.add_column('documents', sa.Column('furthest_read_block_id', sa.String(), nullable=True))
    op.add_column('documents', sa.Column('furthest_read_position', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('furthest_read_updated_at', sa.TIMESTAMP(timezone=True), nullable=True))
    
    # Add foreign key constraint to blocks table
    op.create_foreign_key(
        'fk_documents_furthest_read_block',
        'documents', 
        'blocks',
        ['furthest_read_block_id'], 
        ['id'],
        ondelete='SET NULL'
    )
    
    # Add index for performance (only on documents that have reading progress)
    op.create_index(
        'idx_documents_furthest_read_updated',
        'documents',
        ['furthest_read_updated_at'],
        postgresql_where=sa.text('furthest_read_block_id IS NOT NULL')
    )


def downgrade() -> None:
    # Drop index and foreign key constraint
    op.drop_index('idx_documents_furthest_read_updated', table_name='documents')
    op.drop_constraint('fk_documents_furthest_read_block', 'documents', type_='foreignkey')
    
    # Drop columns
    op.drop_column('documents', 'furthest_read_updated_at')
    op.drop_column('documents', 'furthest_read_position')
    op.drop_column('documents', 'furthest_read_block_id')