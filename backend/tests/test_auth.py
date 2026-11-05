from sqlalchemy import func, select

from app.cli import ensure_initial_admin
from app.extensions import db
from app.models import Admin

from .conftest import NEW_PASSWORD, login


def test_initial_admin_created_once_with_hashed_password(app):
    assert ensure_initial_admin() is True
    assert ensure_initial_admin() is False
    assert db.session.scalar(select(func.count()).select_from(Admin)) == 1
    admin = db.session.scalar(select(Admin))
    assert admin.username == "vglug"
    assert admin.password_hash.startswith("$argon2")
    assert "vglug@123" not in admin.password_hash
    assert admin.must_change_password is True


def test_login_rejects_bad_credentials(client, seeded):
    r = login(client, password="wrong")
    assert r.status_code == 401
    assert r.get_json()["error"]["code"] == "invalid_credentials"
    r = login(client, username="nobody")
    assert r.status_code == 401
    assert "password_hash" not in r.get_data(as_text=True)


def test_first_login_requires_password_change(client, seeded):
    r = login(client)
    assert r.status_code == 200
    body = r.get_json()["data"]
    assert body["admin"]["must_change_password"] is True
    assert "password_hash" not in body["admin"]
    assert client.get("/api/admin/content/blog").get_json()["error"]["code"] == "password_change_required"

    weak = client.post("/api/admin/auth/password", json={"current_password": "vglug@123", "new_password": "short"})
    assert weak.status_code == 422
    wrong = client.post("/api/admin/auth/password", json={"current_password": "nope", "new_password": NEW_PASSWORD})
    assert wrong.status_code == 422

    r = client.post("/api/admin/auth/password", json={"current_password": "vglug@123", "new_password": NEW_PASSWORD})
    assert r.status_code == 200
    client.environ_base["HTTP_X_CSRF_TOKEN"] = r.get_json()["data"]["csrf_token"]
    assert client.get("/api/admin/content/blog").status_code == 200


def test_password_change_invalidates_other_sessions(app, admin, other_client):
    assert login(other_client, password=NEW_PASSWORD).status_code == 200
    r = admin.post("/api/admin/auth/password", json={"current_password": NEW_PASSWORD, "new_password": "An0ther-Strong-Pass!"})
    assert r.status_code == 200
    assert other_client.get("/api/admin/auth/me").status_code == 401


def test_logout(admin):
    assert admin.get("/api/admin/auth/me").status_code == 200
    assert admin.post("/api/admin/auth/logout").status_code == 200
    assert admin.get("/api/admin/auth/me").status_code == 401
    assert admin.get("/api/admin/dashboard").status_code == 401


def test_csrf_and_api_header_required(admin):
    token = admin.environ_base.pop("HTTP_X_CSRF_TOKEN")
    r = admin.post("/api/admin/content/blog", json={"title": "x"})
    assert r.status_code == 403 and r.get_json()["error"]["code"] == "csrf_failed"
    admin.environ_base["HTTP_X_CSRF_TOKEN"] = token
    admin.environ_base.pop("HTTP_X_REQUESTED_WITH")
    r = admin.post("/api/admin/content/blog", json={"title": "x"})
    assert r.status_code == 403 and r.get_json()["error"]["code"] == "bad_origin"


def test_anonymous_cannot_use_admin_api(client, seeded):
    for method, url in [
        ("get", "/api/admin/dashboard"),
        ("post", "/api/admin/content/blog"),
        ("put", "/api/admin/navigation/main"),
        ("put", "/api/admin/footer"),
        ("put", "/api/admin/pages/join"),
        ("post", "/api/admin/media"),
        ("patch", "/api/admin/comments/1"),
    ]:
        assert getattr(client, method)(url, json={}).status_code == 401, url


def test_no_public_account_endpoints(client):
    for url in ["/api/auth/register", "/api/auth/login", "/api/users", "/api/profile", "/api/register"]:
        assert client.post(url, json={}).status_code in (404, 405)
