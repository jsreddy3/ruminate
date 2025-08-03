"""add_has_completed_onboarding_to_users

Revision ID: 9e8568e7f8b5
Revises: add_reading_progress
Create Date: 2025-08-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e8568e7f8b5'
down_revision: Union[str, None] = '7450353594cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add has_completed_onboarding column to users table
    op.add_column('users', sa.Column('has_completed_onboarding', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove has_completed_onboarding column from users table
    op.drop_column('users', 'has_completed_onboarding')