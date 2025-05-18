"""no default version for messages

Revision ID: aa0f8d748149
Revises: b61c9cfa6140
Create Date: 2025-05-18 16:04:23.915722

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa0f8d748149'
down_revision: Union[str, None] = 'b61c9cfa6140'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE messages ALTER COLUMN version DROP DEFAULT;")


def downgrade() -> None:
    op.execute("ALTER TABLE messages ALTER COLUMN version SET DEFAULT 1;")
