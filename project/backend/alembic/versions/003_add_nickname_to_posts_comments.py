"""Add nickname column to posts and comments

Revision ID: 003
Revises: 002
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('nickname', sa.String(length=50), nullable=True))
    op.add_column('comments', sa.Column('nickname', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('comments', 'nickname')
    op.drop_column('posts', 'nickname')

