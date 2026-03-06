"""Add domain_requests table

Revision ID: 002
Revises: 001
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'domain_requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('requester_id', sa.Integer(), nullable=False),
        sa.Column('school_name', sa.String(length=100), nullable=False),
        sa.Column('school_short_name', sa.String(length=20), nullable=False),
        sa.Column('email_domain', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='domainrequeststatus'),
                  nullable=False, server_default='PENDING'),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_domain_requests_requester_id', 'domain_requests', ['requester_id'])
    op.create_index('ix_domain_requests_status', 'domain_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_domain_requests_status', table_name='domain_requests')
    op.drop_index('ix_domain_requests_requester_id', table_name='domain_requests')
    op.drop_table('domain_requests')
    op.execute("DROP TYPE IF EXISTS domainrequeststatus")

