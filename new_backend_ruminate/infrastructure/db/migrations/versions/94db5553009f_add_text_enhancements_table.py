"""Add text_enhancements table

Revision ID: 94db5553009f
Revises: 168dc9a0db77
Create Date: 2025-08-08 16:12:25.481765

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '94db5553009f'
down_revision: Union[str, None] = '168dc9a0db77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Debug: print connection info
    conn = op.get_bind()
    print(f"Connected to: {conn.engine.url}")
    
    # Create enum type for text enhancement types (only if it doesn't exist)
    result = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'textenhancementtype'"))
    if not result.fetchone():
        print("Creating enum type textenhancementtype")
        conn.execute(sa.text("CREATE TYPE textenhancementtype AS ENUM ('DEFINITION', 'ANNOTATION', 'RABBITHOLE')"))
    else:
        print("Enum type textenhancementtype already exists")
    
    # Create text_enhancements table
    from sqlalchemy.dialects import postgresql
    op.create_table('text_enhancements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('type', postgresql.ENUM('DEFINITION', 'ANNOTATION', 'RABBITHOLE', name='textenhancementtype', create_type=False), nullable=False),
        sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('block_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('text_start_offset', sa.Integer(), nullable=False),
        sa.Column('text_end_offset', sa.Integer(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['block_id'], ['blocks.id'], ),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('block_id', 'text_start_offset', 'text_end_offset', 'type', name='uq_text_enhancement_position')
    )
    
    # Create indexes
    op.create_index('idx_text_enhancement_document', 'text_enhancements', ['document_id'], unique=False)
    op.create_index('idx_text_enhancement_block', 'text_enhancements', ['block_id'], unique=False)
    op.create_index('idx_text_enhancement_user', 'text_enhancements', ['user_id'], unique=False)
    op.create_index('idx_text_enhancement_type_document', 'text_enhancements', ['type', 'document_id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_text_enhancement_type_document', table_name='text_enhancements')
    op.drop_index('idx_text_enhancement_user', table_name='text_enhancements')
    op.drop_index('idx_text_enhancement_block', table_name='text_enhancements')
    op.drop_index('idx_text_enhancement_document', table_name='text_enhancements')
    
    # Drop table
    op.drop_table('text_enhancements')
    
    # Drop enum type
    enhancement_type = sa.Enum('DEFINITION', 'ANNOTATION', 'RABBITHOLE', name='textenhancementtype')
    enhancement_type.drop(op.get_bind())
