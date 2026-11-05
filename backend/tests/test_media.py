from pathlib import Path
from unittest import mock

from sqlalchemy import func, select

from app.extensions import db
from app.models import ContentMedia, Media
from app.services.storage import upload_root

from .conftest import make_content, png_bytes, upload


def _count():
    return db.session.scalar(select(func.count()).select_from(Media))


def test_upload_stores_file_and_metadata(admin):
    r = upload(admin, png_bytes(), filename="../../etc/My Photo.PNG")
    assert r.status_code == 201, r.get_json()
    data = r.get_json()["data"]
    media = db.session.get(Media, data["id"])
    assert media.storage_provider == "local" and media.mime_type == "image/png" and media.kind == "image"
    assert media.relative_path.startswith("blogs/") and ".." not in media.relative_path
    assert media.original_filename == "etc_My_Photo.PNG"
    assert (media.width, media.height) == (1200, 600)
    assert (upload_root() / media.relative_path).is_file()
    assert media.thumb_relative_path and (upload_root() / media.thumb_relative_path).is_file()
    assert str(upload_root()) not in str(data)  # filesystem paths never exposed
    assert data["url"] == f"/media/{media.relative_path}"


def test_upload_rejections(admin):
    assert upload(admin, b"#!/bin/sh\nrm -rf /", filename="x.png").status_code == 415
    assert upload(admin, png_bytes(), filename="x.jpg").status_code == 415  # extension mismatch
    assert upload(admin, b"<svg onload=alert(1)>", filename="x.svg").status_code == 415
    assert upload(admin, b"\x89PNG\r\n\x1a\n" + b"garbage" * 10, filename="x.png").status_code == 415
    assert upload(admin, png_bytes(), category="../../etc").status_code == 422
    assert _count() == 0


def test_size_limit(admin, app):
    old = app.config["MAX_IMAGE_BYTES"]
    app.config["MAX_IMAGE_BYTES"] = 100
    try:
        assert upload(admin, png_bytes()).status_code == 413
    finally:
        app.config["MAX_IMAGE_BYTES"] = old
    assert _count() == 0
    assert not [p for p in (upload_root() / "blogs").glob(".*.part")]


def test_storage_failure_creates_no_record(admin):
    with mock.patch("app.services.storage.os.replace", side_effect=OSError("disk full")):
        r = upload(admin, png_bytes())
    assert r.status_code == 500 and r.get_json()["error"]["code"] == "storage_failed"
    assert _count() == 0


def test_media_access_follows_publication(client, admin):
    media = upload(admin, png_bytes()).get_json()["data"]
    assert client.get(media["url"]).status_code == 404  # unused upload is private
    assert admin.get(media["url"]).status_code == 200

    item = make_content(admin, status="draft", cover_media_id=media["id"],
                        body_md=f"Body with image ![x]({media['url']}) and more text.")
    assert client.get(media["url"]).status_code == 404  # draft-only media stays private
    payload = {"title": item["title"], "body_md": item["body_md"], "status": "published", "cover_media_id": media["id"]}
    admin.put(f"/api/admin/content/blog/{item['id']}", json=payload)
    r = client.get(media["url"])
    assert r.status_code == 200 and r.mimetype == "image/png"
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert client.get(media["thumb_url"]).status_code == 200
    assert client.get("/media/../.env").status_code == 404


def test_media_relationships_and_cleanup(client, admin):
    cover = upload(admin, png_bytes()).get_json()["data"]
    gallery = upload(admin, png_bytes(color=(1, 2, 3))).get_json()["data"]
    inline = upload(admin, png_bytes(color=(9, 9, 9))).get_json()["data"]
    item = make_content(admin, cover_media_id=cover["id"], gallery_ids=[gallery["id"]],
                        body_md=f"Text ![inline]({inline['url']}) more words here.")
    links = {(cm.media_id, cm.in_gallery) for cm in db.session.scalars(select(ContentMedia))}
    assert links == {(gallery["id"], True), (inline["id"], False)}
    detail = client.get(f"/api/content/blog/{item['id']}").get_json()["data"]
    assert [g["id"] for g in detail["gallery"]] == [gallery["id"]]

    r = admin.delete(f"/api/admin/media/{cover['id']}")
    assert r.status_code == 409 and r.get_json()["error"]["fields"]["references"][0]["usage"] == "cover"

    files = [upload_root() / db.session.get(Media, m["id"]).relative_path for m in (cover, gallery, inline)]
    r = admin.delete(f"/api/admin/content/blog/{item['id']}")
    assert r.get_json()["data"]["media_removed"] == 3
    assert _count() == 0 and not any(Path(f).exists() for f in files)


def test_shared_media_survives_deletion_of_one_item(admin):
    cover = upload(admin, png_bytes()).get_json()["data"]
    a = make_content(admin, title="A", cover_media_id=cover["id"])
    make_content(admin, title="B", cover_media_id=cover["id"])
    admin.delete(f"/api/admin/content/blog/{a['id']}")
    assert db.session.get(Media, cover["id"]) is not None


def test_storage_status(admin):
    upload(admin, png_bytes())
    status = admin.get("/api/admin/media/status").get_json()["data"]
    assert status["provider"] == "local" and status["writable"] and status["total_files"] == 1
