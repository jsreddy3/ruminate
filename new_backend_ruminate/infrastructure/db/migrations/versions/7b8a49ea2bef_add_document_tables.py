"""add_document_tables

Revision ID: 7b8a49ea2bef
Revises: 3e199b0b532c
Create Date: 2025-07-27 12:43:53.913750

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b8a49ea2bef'
down_revision: Union[str, None] = '3e199b0b532c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create documents table
    op.create_table('documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('s3_pdf_path', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False, server_default='Untitled Document'),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('arguments', sa.JSON(), nullable=True),
        sa.Column('key_themes_terms', sa.JSON(), nullable=True),
        sa.Column('processing_error', sa.String(), nullable=True),
        sa.Column('marker_job_id', sa.String(), nullable=True),
        sa.Column('marker_check_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create pages table
    op.create_table('pages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=False),
        sa.Column('polygon', sa.JSON(), nullable=True),
        sa.Column('block_ids', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('section_hierarchy', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('html_content', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create blocks table
    op.create_table('blocks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('page_id', sa.String(), nullable=True),
        sa.Column('block_type', sa.String(), nullable=True),
        sa.Column('html_content', sa.Text(), nullable=True),
        sa.Column('polygon', sa.JSON(), nullable=True),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('section_hierarchy', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('images', sa.JSON(), nullable=True),
        sa.Column('is_critical', sa.Boolean(), nullable=True),
        sa.Column('critical_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.ForeignKeyConstraint(['page_id'], ['pages.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add document-related columns to conversations table
    op.add_column('conversations', sa.Column('document_id', sa.String(), nullable=True))
    op.add_column('conversations', sa.Column('source_block_id', sa.String(), nullable=True))
    op.add_column('conversations', sa.Column('selected_text', sa.Text(), nullable=True))
    op.add_column('conversations', sa.Column('text_start_offset', sa.Integer(), nullable=True))
    op.add_column('conversations', sa.Column('text_end_offset', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for document_id
    op.create_foreign_key('fk_conversations_document_id', 'conversations', 'documents', ['document_id'], ['id'])
    
    # Add document-related columns to messages table
    op.add_column('messages', sa.Column('document_id', sa.String(), nullable=True))
    op.add_column('messages', sa.Column('block_id', sa.String(), nullable=True))
    
    # Add foreign key constraints for messages
    op.create_foreign_key('fk_messages_document_id', 'messages', 'documents', ['document_id'], ['id'])
    op.create_foreign_key('fk_messages_block_id', 'messages', 'blocks', ['block_id'], ['id'])


def downgrade() -> None:
    # Drop foreign key constraints from messages table
    op.drop_constraint('fk_messages_block_id', 'messages', type_='foreignkey')
    op.drop_constraint('fk_messages_document_id', 'messages', type_='foreignkey')
    
    # Drop document-related columns from messages table
    op.drop_column('messages', 'block_id')
    op.drop_column('messages', 'document_id')
    
    # Drop foreign key constraint from conversations table
    op.drop_constraint('fk_conversations_document_id', 'conversations', type_='foreignkey')
    
    # Drop document-related columns from conversations table
    op.drop_column('conversations', 'text_end_offset')
    op.drop_column('conversations', 'text_start_offset')
    op.drop_column('conversations', 'selected_text')
    op.drop_column('conversations', 'source_block_id')
    op.drop_column('conversations', 'document_id')
    
    # Drop tables in reverse order due to foreign key constraints
    op.drop_table('blocks')
    op.drop_table('pages')
    op.drop_table('documents')
