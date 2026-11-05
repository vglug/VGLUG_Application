from unittest import mock

from sqlalchemy import func, select

from app.extensions import db
from app.models import EmailOutbox, Subscriber
from app.services import email as email_service
from app.services.email import make_unsubscribe_token, make_verify_token, process_outbox

from .conftest import make_content


def subscribe(client, email="reader@example.org", **prefs):
    return client.post("/api/subscriptions", json={"email": email, **prefs})


def confirm(client, email="reader@example.org"):
    sub = db.session.scalar(select(Subscriber).where(Subscriber.email == email))
    return client.post("/api/subscriptions/confirm", json={"token": make_verify_token(sub.id, sub.email)})


def test_subscribe_verify_flow(client, seeded):
    assert subscribe(client, email="Reader@Example.org").status_code == 202
    sub = db.session.scalar(select(Subscriber))
    assert sub.email == "reader@example.org" and sub.status == "pending"
    assert process_outbox()["sent"] == 1
    msg = email_service.memory_outbox[-1]
    assert "Confirm" in msg["Subject"] and "/subscribe/confirm?token=" in msg.get_body(("plain",)).get_content()

    assert client.post("/api/subscriptions/confirm", json={"token": "x" * 40}).status_code == 400
    assert confirm(client).status_code == 200
    db.session.refresh(sub)
    assert sub.status == "active"


def test_subscribe_validation_and_no_enumeration(client, seeded):
    assert subscribe(client, email="not-an-email").status_code == 422
    assert subscribe(client, blogs=False, events=False, meetups=False).status_code == 422
    first = subscribe(client)
    second = subscribe(client)
    assert first.get_json() == second.get_json()
    # Resend is throttled: only one verification queued.
    assert db.session.scalar(select(func.count()).select_from(EmailOutbox)) == 1


def test_publish_sends_one_announcement(client, admin):
    subscribe(client)
    confirm(client)
    subscribe(client, email="events-only@example.org", blogs=False)
    confirm(client, "events-only@example.org")
    process_outbox()
    email_service.memory_outbox.clear()

    draft = make_content(admin, status="draft", title="Draft post")
    assert db.session.scalar(select(func.count()).select_from(EmailOutbox).where(EmailOutbox.kind == "announcement")) == 0

    body = {"title": "Draft post", "body_md": "Now ready to be published here.", "status": "published"}
    admin.put(f"/api/admin/content/blog/{draft['id']}", json=body)
    # Unpublish and publish again: no duplicate.
    admin.put(f"/api/admin/content/blog/{draft['id']}", json={**body, "status": "draft"})
    admin.put(f"/api/admin/content/blog/{draft['id']}", json=body)

    assert process_outbox()["sent"] == 1
    assert len(email_service.memory_outbox) == 1
    msg = email_service.memory_outbox[0]
    assert msg["To"] == "reader@example.org"
    assert "Draft post" in msg["Subject"]
    text = msg.get_body(("plain",)).get_content()
    assert f"/blogs/{draft['id']}-draft-post" in text and "/unsubscribe?token=" in text
    assert msg["List-Unsubscribe"]
    assert process_outbox()["sent"] == 0


def test_unsubscribe(client, admin):
    subscribe(client)
    confirm(client)
    sub = db.session.scalar(select(Subscriber))
    token = make_unsubscribe_token(sub.id, sub.email)
    assert client.post("/api/subscriptions/unsubscribe", json={"token": token}).status_code == 200
    db.session.refresh(sub)
    assert sub.status == "unsubscribed"
    make_content(admin, title="After unsubscribe")
    process_outbox()
    assert all("After unsubscribe" not in (m["Subject"] or "") for m in email_service.memory_outbox)


def test_delivery_failure_is_retried_not_raised(client, admin, app):
    subscribe(client)
    with mock.patch.object(email_service, "deliver", side_effect=OSError("smtp down")):
        result = process_outbox()
    assert result == {"sent": 0, "failed": 1}
    entry = db.session.scalar(select(EmailOutbox))
    assert entry.status == "pending" and entry.attempts == 1 and "OSError" in entry.last_error


def test_publishing_works_when_subscriptions_disabled(admin, app):
    app.config["SUBSCRIPTIONS_ENABLED"] = False
    try:
        make_content(admin, title="Still publishes")
    finally:
        app.config["SUBSCRIPTIONS_ENABLED"] = True
    assert db.session.scalar(select(func.count()).select_from(EmailOutbox)) == 0


def test_admin_manages_subscribers(client, admin):
    subscribe(client)
    sub_id = admin.get("/api/admin/subscribers").get_json()["data"][0]["id"]
    assert admin.patch(f"/api/admin/subscribers/{sub_id}", json={"status": "unsubscribed"}).get_json()["data"]["status"] == "unsubscribed"
    assert admin.delete(f"/api/admin/subscribers/{sub_id}").status_code == 200
    assert client.get("/api/admin/subscribers").status_code == 401
