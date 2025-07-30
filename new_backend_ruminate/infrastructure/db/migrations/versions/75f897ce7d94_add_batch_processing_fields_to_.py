"""Add batch processing fields to documents table

Revision ID: 75f897ce7d94
Revises: 812d73dec9e6
Create Date: 2025-07-29 18:04:24.039633

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75f897ce7d94'
down_revision: Union[str, None] = '812d73dec9e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add batch processing fields to documents table
    op.add_column('documents', sa.Column('parent_document_id', sa.String(), nullable=True))
    op.add_column('documents', sa.Column('batch_id', sa.String(), nullable=True))
    op.add_column('documents', sa.Column('chunk_index', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('total_chunks', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('is_auto_processed', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add foreign key for parent_document_id
    op.create_foreign_key(
        'fk_documents_parent_document_id',
        'documents', 
        'documents', 
        ['parent_document_id'], 
        ['id']
    )


def downgrade() -> None:
    # Remove foreign key
    op.drop_constraint('fk_documents_parent_document_id', 'documents', type_='foreignkey')
    
    # Remove batch processing fields
    op.drop_column('documents', 'is_auto_processed')
    op.drop_column('documents', 'total_chunks')
    op.drop_column('documents', 'chunk_index')
    op.drop_column('documents', 'batch_id')
    op.drop_column('documents', 'parent_document_id')
