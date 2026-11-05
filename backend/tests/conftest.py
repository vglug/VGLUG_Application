import io
import os

import pytest
from flask_migrate import upgrade
from PIL import Image
from sqlalchemy import text

from app import create_app
from app.cli import ensure_initial_admin, seed_footer, seed_navigation, seed_pages
from app.config import TestConfig
from app.extensions import db
from app.services import email as email_service

NEW_PASSWORD = "Str0ng-Admin-Passphrase!"


@pytest.fixture(scope="session")
def app(tmp_path_factory):
    if not TestConfig.SQLALCHEMY_DATABASE_URI:
        pytest.exit("TEST_DATABASE_URL must point to a disposable PostgreSQL database.", returncode=2)
    TestConfig.UPLOAD_FOLDER = str(tmp_path_factory.mktemp("uploads"))
    app = create_app(TestConfig)
    with app.app_context():
        db.session.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        db.session.commit()
        upgrade()
    yield app


@pytest.fixture(autouse=True)
def clean_db(app):
    with app.app_context():
        tables = ", ".join(t.name for t in db.metadata.sorted_tables)
        db.session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        db.session.commit()
        email_service.memory_outbox.clear()
        yield
        db.session.remove()


def _client(app):
    c = app.test_client()
    c.environ_base["HTTP_X_REQUESTED_WITH"] = "fetch"
    return c


@pytest.fixture
def client(app):
    return _client(app)


@pytest.fixture
def other_client(app):
    return _client(app)


@pytest.fixture
def seeded(app):
    ensure_initial_admin()
    seed_pages()
    seed_navigation()
    seed_footer()


def login(c, username="vglug", password="vglug@123"):
    r = c.post("/api/admin/auth/login", json={"username": username, "password": password})
    if r.status_code == 200:
        c.environ_base["HTTP_X_CSRF_TOKEN"] = r.get_json()["data"]["csrf_token"]
    return r


@pytest.fixture
def admin(app, seeded):
    c = _client(app)
    assert login(c).status_code == 200
    r = c.post("/api/admin/auth/password", json={"current_password": "vglug@123", "new_password": NEW_PASSWORD})
    assert r.status_code == 200, r.get_json()
    c.environ_base["HTTP_X_CSRF_TOKEN"] = r.get_json()["data"]["csrf_token"]
    return c


def png_bytes(size=(1200, 600), color=(70, 5, 13)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


def upload(admin_client, data: bytes, filename="photo.png", category="blogs", alt="Alt text"):
    return admin_client.post(
        "/api/admin/media",
        data={"file": (io.BytesIO(data), filename), "category": category, "alt_text": alt},
        content_type="multipart/form-data",
    )


def make_content(admin_client, ctype="blog", status="published", **overrides):
    payload = {
        "title": overrides.pop("title", f"A {ctype} title"),
        "summary": "Short summary",
        "body_md": "This is the body of the post with enough text.",
        "status": status,
    }
    if ctype in ("event", "meetup"):
        payload["event"] = {"starts_local": "2030-01-10T10:00", "ends_local": "2030-01-10T13:00",
                            "timezone": "Asia/Kolkata", "location_name": "Viluppuram"}
    payload.update(overrides)
    r = admin_client.post(f"/api/admin/content/{ctype}", json=payload)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]


os.environ.setdefault("FLASK_APP", "wsgi.py")
