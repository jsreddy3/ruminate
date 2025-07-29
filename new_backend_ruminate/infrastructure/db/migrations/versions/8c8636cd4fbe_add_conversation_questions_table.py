"""add_conversation_questions_table

Revision ID: 8c8636cd4fbe
Revises: a473eeaffa31
Create Date: 2025-07-28 18:15:30.390761

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c8636cd4fbe'
down_revision: Union[str, None] = 'a473eeaffa31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The questiontype enum already exists, just create the table
    # Create conversation_questions table
    op.create_table(
        'conversation_questions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_type', sa.String(), nullable=False),  # Use String instead of Enum to avoid creation issues
        sa.Column('source_page_numbers', sa.JSON(), nullable=True),
        sa.Column('source_block_ids', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('generation_context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('id', name='uq_conversation_question_id')
    )
    
    # Create indexes
    op.create_index('ix_conversation_questions_conv_id', 'conversation_questions', ['conversation_id'])
    op.create_index('ix_conversation_questions_created', 'conversation_questions', ['created_at'])


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('ix_conversation_questions_created', table_name='conversation_questions')
    op.drop_index('ix_conversation_questions_conv_id', table_name='conversation_questions')
    
    # Drop table
    op.drop_table('conversation_questions')
    
    # Drop enum
    questiontype_enum = sa.Enum(name='questiontype')
    questiontype_enum.drop(op.get_bind())
