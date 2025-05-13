"""strip document columns

Revision ID: 1d183cd9fab5
Revises: 53abfdb16379
Create Date: 2025-05-13 15:23:54.865039

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d183cd9fab5'
down_revision: Union[str, None] = '53abfdb16379'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # drop indexes that depend on the soon-to-be-dropped columns
    op.drop_index("ix_conversations_document_id", table_name="conversations")
    op.drop_index("ix_conversations_source_block_id", table_name="conversations")

    # drop the columns themselves
    with op.batch_alter_table("conversations") as batch:
        batch.drop_column("document_id")
        batch.drop_column("included_pages")
        batch.drop_column("source_block_id")
        batch.drop_column("selected_text")
        batch.drop_column("text_start_offset")
        batch.drop_column("text_end_offset")


def downgrade() -> None:
    # add the columns back
    with op.batch_alter_table("conversations") as batch:
        batch.add_column(sa.Column("text_end_offset", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("text_start_offset", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("selected_text", sa.Text(), nullable=True))
        batch.add_column(sa.Column("source_block_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("included_pages", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
        batch.add_column(sa.Column("document_id", sa.String(), nullable=True))

    # recreate the two indexes
    op.create_index(
        "ix_conversations_source_block_id",
        "conversations",
        ["source_block_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversations_document_id",
        "conversations",
        ["document_id"],
        unique=False,
    )