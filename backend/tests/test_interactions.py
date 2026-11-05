from sqlalchemy import select

from app.extensions import db
from app.models import Like

from .conftest import make_content


def test_like_is_unique_per_visitor(client, other_client, admin):
    item = make_content(admin)
    url = f"/api/content/{item['id']}/like"
    assert client.post(url).get_json()["data"] == {"like_count": 1, "liked": True}
    assert client.post(url).get_json()["data"] == {"like_count": 1, "liked": True}
    assert other_client.post(url).get_json()["data"] == {"like_count": 2, "liked": True}
    assert client.delete(url).get_json()["data"] == {"like_count": 1, "liked": False}
    # Visitor identity is a keyed hash; no raw cookie or IP is stored.
    stored = db.session.scalars(select(Like.visitor_hash)).all()
    assert len(stored) == 1 and len(stored[0]) == 64
    detail = other_client.get(f"/api/content/blog/{item['id']}").get_json()["data"]
    assert detail["liked"] is True and detail["like_count"] == 1


def test_comment_moderation_flow(client, admin):
    item = make_content(admin)
    url = f"/api/content/{item['id']}/comments"
    r = client.post(url, json={"author_name": "Asha", "body": "Great post about <b>freedom</b>!"})
    assert r.status_code == 201 and r.get_json()["data"]["status"] == "pending"
    assert client.get(url).get_json()["data"] == []

    pending = admin.get("/api/admin/comments?status=pending").get_json()["data"]
    assert len(pending) == 1
    cid = pending[0]["id"]
    # Anonymous visitors cannot moderate.
    assert client.patch(f"/api/admin/comments/{cid}", json={"status": "approved"}).status_code == 401
    assert admin.patch(f"/api/admin/comments/{cid}", json={"status": "approved"}).status_code == 200

    comments = client.get(url).get_json()["data"]
    assert comments[0]["body"] == "Great post about <b>freedom</b>!"  # returned as text, rendered escaped
    assert client.get(f"/api/content/blog/{item['id']}").get_json()["data"]["comment_count"] == 1

    assert admin.patch(f"/api/admin/comments/{cid}", json={"status": "rejected"}).status_code == 200
    assert client.get(url).get_json()["data"] == []
    assert admin.delete(f"/api/admin/comments/{cid}").status_code == 200


def test_comment_validation_and_spam(client, admin):
    item = make_content(admin)
    url = f"/api/content/{item['id']}/comments"
    assert client.post(url, json={"body": ""}).status_code == 422
    assert client.post(url, json={"body": "x" * 2001}).status_code == 422
    links = "see http://a.example http://b.example http://c.example"
    assert "body" in client.post(url, json={"body": links}).get_json()["error"]["fields"]
    assert client.post(url, json={"body": "hi there", "author_name": "<script>"}).status_code == 422
    # Honeypot submissions look successful but are discarded.
    r = client.post(url, json={"body": "Buy now", "website": "http://spam.example"})
    assert r.status_code == 201
    assert admin.get("/api/admin/comments?status=all").get_json()["meta"]["total"] == 0
    # Duplicate detection.
    assert client.post(url, json={"body": "Same text"}).status_code == 201
    assert client.post(url, json={"body": "Same text"}).status_code == 409
