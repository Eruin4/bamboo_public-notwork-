"""Add hot_post_threshold to boards

Revision ID: 005
Revises: 004
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hot_post_threshold to boards
    op.add_column('boards', sa.Column('hot_post_threshold', sa.Integer(), nullable=False, server_default='5'))


def downgrade() -> None:
    op.drop_column('boards', 'hot_post_threshold')
