"""Add con (emoticon) tables

Revision ID: 006
Revises: 005
Create Date: 2026-03-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # con_packs 테이블
    op.create_table(
        'con_packs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('uploader_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='conpackstatus'), nullable=False, server_default='PENDING'),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_con_packs_uploader_id', 'con_packs', ['uploader_id'])
    op.create_index('ix_con_packs_status', 'con_packs', ['status'])

    # con_items 테이블
    op.create_table(
        'con_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('pack_id', sa.Integer(), sa.ForeignKey('con_packs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_id', sa.Integer(), sa.ForeignKey('files.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(50), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_con_items_pack_id', 'con_items', ['pack_id'])

    # user_con_packs 테이블
    op.create_table(
        'user_con_packs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pack_id', sa.Integer(), sa.ForeignKey('con_packs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'pack_id', name='uq_user_con_pack'),
    )
    op.create_index('ix_user_con_packs_user_id', 'user_con_packs', ['user_id'])
    op.create_index('ix_user_con_packs_pack_id', 'user_con_packs', ['pack_id'])


def downgrade() -> None:
    op.drop_table('user_con_packs')
    op.drop_table('con_items')
    op.drop_table('con_packs')
    op.execute("DROP TYPE IF EXISTS conpackstatus")
