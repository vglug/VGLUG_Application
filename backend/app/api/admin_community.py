from typing import Literal

from flask import Blueprint, current_app, request
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from ..errors import not_found, ok
from ..extensions import db
from ..models import Comment, ContentItem, EmailOutbox, SitePage, Subscriber, utcnow
from ..security import admin_required, current_admin
from ..services.content import iso, public_path
from ..services.email import email_ready, process_outbox
from ..validation import page_meta, pagination_args, parse_body

bp = Blueprint("admin_community", __name__, url_prefix="/api/admin")


def _count(stmt) -> int:
    return db.session.scalar(select(func.count()).select_from(stmt.subquery()))


@bp.get("/dashboard")
@admin_required()
def dashboard():
    counts = {}
    for ctype, status, n in db.session.execute(
        select(ContentItem.type, ContentItem.status, func.count()).group_by(ContentItem.type, ContentItem.status)
    ):
        counts.setdefault(ctype, {"draft": 0, "published": 0, "archived": 0})[status] = n
    pages = [{"key": p.key, "title": p.title, "status": p.status} for p in db.session.scalars(select(SitePage))]
    return ok(
        {
            "content": counts,
            "pages": pages,
            "pending_comments": _count(select(Comment.id).where(Comment.status == "pending")),
            "subscribers": dict(
                db.session.execute(select(Subscriber.status, func.count()).group_by(Subscriber.status)).all()
            ),
            "outbox": dict(db.session.execute(select(EmailOutbox.status, func.count()).group_by(EmailOutbox.status)).all()),
            "email": {
                "backend": current_app.config["EMAIL_BACKEND"],
                "ready": email_ready(),
                "subscriptions_enabled": current_app.config["SUBSCRIPTIONS_ENABLED"],
            },
        }
    )


# --- Comments ----------------------------------------------------------------------


@bp.get("/comments")
@admin_required()
def list_comments():
    page, per_page = pagination_args(default_per_page=25, max_per_page=100)
    stmt = select(Comment, ContentItem).join(ContentItem, ContentItem.id == Comment.content_id)
    status = request.args.get("status", "pending")
    if status in ("pending", "approved", "rejected"):
        stmt = stmt.where(Comment.status == status)
    total = _count(stmt)
    rows = db.session.execute(
        stmt.order_by(Comment.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    ).all()
    return ok(
        [
            {
                "id": c.id,
                "author_name": c.author_name or "Anonymous",
                "body": c.body,
                "status": c.status,
                "created_at": iso(c.created_at),
                "moderated_at": iso(c.moderated_at),
                "content": {"id": item.id, "type": item.type, "title": item.title, "path": public_path(item)},
            }
            for c, item in rows
        ],
        meta=page_meta(page, per_page, total),
    )


class ModerateIn(BaseModel):
    status: Literal["pending", "approved", "rejected"]


@bp.patch("/comments/<int:comment_id>")
@admin_required()
def moderate_comment(comment_id: int):
    comment = db.session.get(Comment, comment_id)
    if comment is None:
        raise not_found("Comment not found.")
    comment.status = parse_body(ModerateIn).status
    comment.moderated_at = utcnow()
    comment.moderated_by_id = current_admin().id
    db.session.commit()
    return ok({"id": comment.id, "status": comment.status})


@bp.delete("/comments/<int:comment_id>")
@admin_required()
def delete_comment(comment_id: int):
    comment = db.session.get(Comment, comment_id)
    if comment is None:
        raise not_found("Comment not found.")
    db.session.delete(comment)
    db.session.commit()
    return ok({"deleted": comment_id})


# --- Subscribers -----------------------------------------------------------------


@bp.get("/subscribers")
@admin_required()
def list_subscribers():
    page, per_page = pagination_args(default_per_page=25, max_per_page=100)
    stmt = select(Subscriber)
    status = request.args.get("status")
    if status in ("pending", "active", "unsubscribed"):
        stmt = stmt.where(Subscriber.status == status)
    q = (request.args.get("q") or "").strip().lower()[:100]
    if q:
        stmt = stmt.where(or_(Subscriber.email.contains(q, autoescape=True)))
    total = _count(stmt)
    rows = db.session.scalars(stmt.order_by(Subscriber.created_at.desc()).offset((page - 1) * per_page).limit(per_page))
    return ok(
        [
            {
                "id": s.id,
                "email": s.email,
                "status": s.status,
                "wants_blogs": s.wants_blogs,
                "wants_events": s.wants_events,
                "wants_meetups": s.wants_meetups,
                "created_at": iso(s.created_at),
                "confirmed_at": iso(s.confirmed_at),
            }
            for s in rows
        ],
        meta=page_meta(page, per_page, total),
    )


class SubscriberUpdateIn(BaseModel):
    status: Literal["active", "unsubscribed"] | None = None
    wants_blogs: bool | None = None
    wants_events: bool | None = None
    wants_meetups: bool | None = None


@bp.patch("/subscribers/<int:sub_id>")
@admin_required()
def update_subscriber(sub_id: int):
    sub = db.session.get(Subscriber, sub_id)
    if sub is None:
        raise not_found("Subscriber not found.")
    data = parse_body(SubscriberUpdateIn)
    if data.status == "unsubscribed":
        sub.status, sub.unsubscribed_at = "unsubscribed", utcnow()
    elif data.status == "active" and sub.status == "pending":
        # Admins may only re-activate people who confirmed before; pending ones must confirm themselves.
        pass
    elif data.status == "active" and sub.confirmed_at:
        sub.status, sub.unsubscribed_at = "active", None
    for field in ("wants_blogs", "wants_events", "wants_meetups"):
        if getattr(data, field) is not None:
            setattr(sub, field, getattr(data, field))
    db.session.commit()
    return ok({"id": sub.id, "status": sub.status})


@bp.delete("/subscribers/<int:sub_id>")
@admin_required()
def delete_subscriber(sub_id: int):
    sub = db.session.get(Subscriber, sub_id)
    if sub is None:
        raise not_found("Subscriber not found.")
    db.session.delete(sub)
    db.session.commit()
    return ok({"deleted": sub_id})


@bp.post("/email/process")
@admin_required()
def process_email_queue():
    return ok(process_outbox(batch_size=25))
