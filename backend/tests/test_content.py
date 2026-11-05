from .conftest import make_content


def test_drafts_are_not_public(client, admin):
    draft = make_content(admin, status="draft", title="Secret draft")
    assert client.get(f"/api/content/blog/{draft['id']}").status_code == 404
    listing = client.get("/api/content?type=blog").get_json()
    assert listing["data"] == [] and listing["meta"]["total"] == 0
    assert client.get(f"/api/content/{draft['id']}/comments").status_code == 404
    assert client.post(f"/api/content/{draft['id']}/like").status_code == 404


def test_publish_and_view(client, admin):
    item = make_content(admin, title="Hello Freedom")
    assert item["slug"] == "hello-freedom"
    assert item["path"] == f"/blogs/{item['id']}-hello-freedom"
    r = client.get(f"/api/content/blog/{item['id']}")
    assert r.status_code == 200
    data = r.get_json()["data"]
    assert data["title"] == "Hello Freedom" and "<p>" in data["body_html"]
    assert "body_md" not in data and "status" not in data
    # Type mismatch never leaks.
    assert client.get(f"/api/content/event/{item['id']}").status_code == 404


def test_unpublish_and_archive_hide_content(client, admin):
    item = make_content(admin)
    payload = {"title": item["title"], "body_md": "Body text long enough to publish.", "status": "archived"}
    assert admin.put(f"/api/admin/content/blog/{item['id']}", json=payload).status_code == 200
    assert client.get(f"/api/content/blog/{item['id']}").status_code == 404


def test_validation_errors(admin):
    make_content(admin, title="Same", slug="same")
    r = admin.post("/api/admin/content/blog", json={"title": "Other", "slug": "same"})
    assert r.status_code == 422 and "slug" in r.get_json()["error"]["fields"]
    r = admin.post("/api/admin/content/blog", json={"title": "Bad", "slug": "Bad Slug!"})
    assert "slug" in r.get_json()["error"]["fields"]
    r = admin.post("/api/admin/content/blog", json={"title": "Empty", "status": "published", "body_md": ""})
    assert "body_md" in r.get_json()["error"]["fields"]
    r = admin.post("/api/admin/content/blog", json={"title": ""})
    assert r.status_code == 422
    r = admin.post("/api/admin/content/event", json={"title": "No date"})
    assert "event.starts_local" in r.get_json()["error"]["fields"]


def test_event_fields_and_timezone(client, admin):
    ev = make_content(admin, ctype="event", event={
        "starts_local": "2030-05-01T18:00", "ends_local": "2030-05-01T20:00", "timezone": "Asia/Kolkata",
        "location_name": "Hall", "registration_url": "https://example.org/register",
    })
    data = client.get(f"/api/content/event/{ev['id']}").get_json()["data"]
    assert data["event"]["starts_at"].startswith("2030-05-01T12:30")  # stored in UTC
    assert data["event"]["registration_url"] == "https://example.org/register"
    assert ev["event_form"]["starts_local"] == "2030-05-01T18:00"

    bad = admin.post("/api/admin/content/event", json={
        "title": "Bad", "event": {"starts_local": "2030-05-01T18:00", "ends_local": "2030-05-01T17:00",
                                  "timezone": "Mars/Base", "registration_url": "javascript:alert(1)"}})
    fields = bad.get_json()["error"]["fields"]
    assert "event.timezone" in fields and "event.registration_url" in fields


def test_upcoming_and_past_filters(client, admin):
    make_content(admin, ctype="meetup", title="Future", event={"starts_local": "2099-01-01T10:00", "timezone": "UTC"})
    make_content(admin, ctype="meetup", title="Past", event={"starts_local": "2001-01-01T10:00", "timezone": "UTC"})
    up = client.get("/api/content?type=meetup&when=upcoming").get_json()["data"]
    past = client.get("/api/content?type=meetup&when=past").get_json()["data"]
    assert [i["title"] for i in up] == ["Future"] and [i["title"] for i in past] == ["Past"]


def test_search_and_pagination(client, admin):
    for i in range(5):
        make_content(admin, title=f"Linux tips {i}")
    make_content(admin, title="Unrelated")
    r = client.get("/api/content?type=blog&q=linux&per_page=2&page=2").get_json()
    assert r["meta"] == {"page": 2, "per_page": 2, "total": 5, "pages": 3}
    assert len(r["data"]) == 2


def test_delete_content(client, admin):
    item = make_content(admin)
    assert admin.delete(f"/api/admin/content/blog/{item['id']}").status_code == 200
    assert client.get(f"/api/content/blog/{item['id']}").status_code == 404
