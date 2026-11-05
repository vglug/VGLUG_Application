"""Allow 'features' and 'links' page section layouts.

Revision ID: 0002_section_layouts
Revises: dccb4febc970
"""
from alembic import op

revision = "0002_section_layouts"
down_revision = "dccb4febc970"
branch_labels = None
depends_on = None

OLD = "layout IN ('prose', 'cards', 'list', 'awards', 'stats', 'callout')"
NEW = "layout IN ('prose', 'cards', 'list', 'awards', 'stats', 'callout', 'features', 'links')"


def upgrade():
    op.drop_constraint(op.f("ck_page_sections_layout_valid"), "page_sections", type_="check")
    op.create_check_constraint(op.f("ck_page_sections_layout_valid"), "page_sections", NEW)


def downgrade():
    op.execute("UPDATE page_sections SET layout = 'cards' WHERE layout IN ('features', 'links')")
    op.drop_constraint(op.f("ck_page_sections_layout_valid"), "page_sections", type_="check")
    op.create_check_constraint(op.f("ck_page_sections_layout_valid"), "page_sections", OLD)
