"""Add default_per_piece to products

Revision ID: 007_add_default_per_piece
Revises: 006_add_user_language
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_default_per_piece'
down_revision = '006_add_user_language'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('default_per_piece', sa.Numeric(20, 4), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'default_per_piece')