"""add rabbithole enum value

Revision ID: 8a9b2c3d4e5f
Revises: 7b8a49ea2bef
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a9b2c3d4e5f'
down_revision = '7b8a49ea2bef'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # For PostgreSQL, we need to alter the enum type
    # For SQLite, enum is stored as string so no action needed
    connection = op.get_bind()
    if connection.dialect.name == 'postgresql':
        # Add new value to the enum type
        op.execute("ALTER TYPE conversationtype ADD VALUE IF NOT EXISTS 'RABBITHOLE'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    # This would require recreating the entire enum type
    pass