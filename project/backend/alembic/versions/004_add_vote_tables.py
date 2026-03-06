"""Add vote tables and like/dislike counts

Revision ID: 004
Revises: 003
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL to create enum and tables to avoid SQLAlchemy's auto-create conflicts
    op.execute("DO $$ BEGIN CREATE TYPE vote_type_enum AS ENUM ('LIKE', 'DISLIKE'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    op.execute("""
        CREATE TABLE post_votes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            vote_type vote_type_enum NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_post_vote_user_post UNIQUE (user_id, post_id)
        );
    """)
    op.execute("CREATE INDEX ix_post_votes_user_id ON post_votes (user_id);")
    op.execute("CREATE INDEX ix_post_votes_post_id ON post_votes (post_id);")

    op.execute("""
        CREATE TABLE comment_votes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
            vote_type vote_type_enum NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_comment_vote_user_comment UNIQUE (user_id, comment_id)
        );
    """)
    op.execute("CREATE INDEX ix_comment_votes_user_id ON comment_votes (user_id);")
    op.execute("CREATE INDEX ix_comment_votes_comment_id ON comment_votes (comment_id);")

    # Add like_count and dislike_count to posts
    op.add_column('posts', sa.Column('like_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('posts', sa.Column('dislike_count', sa.Integer(), nullable=False, server_default='0'))

    # Add like_count and dislike_count to comments
    op.add_column('comments', sa.Column('like_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('comments', sa.Column('dislike_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('comments', 'dislike_count')
    op.drop_column('comments', 'like_count')
    op.drop_column('posts', 'dislike_count')
    op.drop_column('posts', 'like_count')

    op.execute("DROP TABLE IF EXISTS comment_votes;")
    op.execute("DROP TABLE IF EXISTS post_votes;")
    op.execute("DROP TYPE IF EXISTS vote_type_enum;")
