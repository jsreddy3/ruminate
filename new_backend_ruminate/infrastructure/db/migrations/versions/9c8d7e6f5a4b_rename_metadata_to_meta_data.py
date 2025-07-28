"""rename metadata to meta_data

Revision ID: 9c8d7e6f5a4b
Revises: 8a9b2c3d4e5f
Create Date: 2025-07-27 15:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9c8d7e6f5a4b'
down_revision = '8a9b2c3d4e5f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename metadata column to meta_data to avoid potential conflicts
    op.alter_column('blocks', 'metadata',
                    new_column_name='meta_data',
                    existing_type=sa.JSON(),
                    existing_nullable=True)


def downgrade() -> None:
    # Rename back to metadata
    op.alter_column('blocks', 'meta_data',
                    new_column_name='metadata',
                    existing_type=sa.JSON(),
                    existing_nullable=True)