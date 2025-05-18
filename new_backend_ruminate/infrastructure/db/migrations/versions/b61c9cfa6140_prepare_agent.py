"""prepare agent

Revision ID: b61c9cfa6140
Revises: 1d183cd9fab5
Create Date: 2025-05-18 14:30:43.861297

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b61c9cfa6140'
down_revision: Union[str, None] = '1d183cd9fab5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend Postgres ENUMs; harmless no-ops under SQLite.
    op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'tool'")
    op.execute("ALTER TYPE conversationtype ADD VALUE IF NOT EXISTS 'agent'")


def downgrade() -> None:
    # Postgres cannot drop enum values without rewrite; leave as-is.
    pass
