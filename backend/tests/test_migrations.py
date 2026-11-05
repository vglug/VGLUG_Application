from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect

from app.extensions import db


def test_migrations_roll_back_and_reapply(app):
    db.session.remove()
    downgrade(revision="base")
    assert "content_items" not in inspect(db.engine).get_table_names()
    upgrade()
    tables = set(inspect(db.engine).get_table_names())
    assert {"admins", "content_items", "media", "likes", "comments", "email_outbox", "nav_items"} <= tables
    # No public user/account tables exist.
    assert not tables & {"users", "user_profiles", "accounts"}
