"""Public, unauthenticated API. Only published content is ever returned."""

import re
from datetime import timedelta

from flask import Blueprint, current_app, request
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import selectinload

from ..errors import ApiError, not_found, ok
from ..extensions import db, limiter
from ..models import CONTENT_TYPES, Comment, ContentItem, EventDetails, Like, SitePage, Subscriber, utcnow
from ..security import visitor_hash
from ..services.content import interaction_counts, iso, liked_set, serialize_detail, serialize_summary
from ..services.email import read_unsubscribe_token, read_verify_token, subscriptions_available
from ..services.notifications import queue_verification
from ..services.site import get_footer, nav_tree, serialize_footer, serialize_page
from ..validation import is_valid_email, page_meta, pagination_args, parse_body

bp = Blueprint("public", __name__, url_prefix="/api")

URL_RE = re.compile(r"(https?://|www\.)", re.I)


def _published(content_id: int) -> ContentItem:
    item = db.session.get(ContentItem, content_id)
    if item is None or item.status != "published":
        raise not_found("This content is not available.")
    return item


@bp.get("/health")
def health():
    db.session.execute(select(1))
    return ok({"status": "ok"})


@bp.get("/site")
def site():
    return ok(
        {
            "nav": nav_tree("main"),
            "footer_links": nav_tree("footer"),
            "footer": serialize_footer(get_footer()),
            "features": {
                "subscriptions": subscriptions_available(),
                "comments_require_approval": current_app.config["COMMENTS_REQUIRE_APPROVAL"],
                "comment_max_length": current_app.config["COMMENT_MAX_LENGTH"],
            },
        }
    )


@bp.get("/pages/<key>")
def page(key: str):
    page = db.session.scalar(
        select(SitePage).where(SitePage.key == key, SitePage.status == "published").options(selectinload(SitePage.sections))
    )
    if page is None:
        raise not_found("This page has not been published yet.")
    return ok(serialize_page(page))


@bp.get("/content")
def list_content():
    ctype = request.args.get("type", "")
    if ctype and ctype not in CONTENT_TYPES:
        raise ApiError(400, "bad_request", "Unknown content type.")
    page, per_page = pagination_args()
    q = (request.args.get("q") or "").strip()[:100]
    when = request.args.get("when", "")

    stmt = select(ContentItem).where(ContentItem.status == "published")
    if ctype:
        stmt = stmt.where(ContentItem.type == ctype)
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(or_(ContentItem.title.ilike(like), ContentItem.summary.ilike(like)))

    order = [ContentItem.published_at.desc(), ContentItem.id.desc()]
    if ctype in ("event", "meetup") and when in ("upcoming", "past"):
        now = utcnow()
        stmt = stmt.join(EventDetails, EventDetails.content_id == ContentItem.id)
        ongoing = or_(
            EventDetails.starts_at >= now,
            and_(EventDetails.ends_at.is_not(None), EventDetails.ends_at >= now),
        )
        if when == "upcoming":
            stmt = stmt.where(ongoing)
            order = [EventDetails.starts_at.asc(), ContentItem.id]
        else:
            stmt = stmt.where(~ongoing)
            order = [EventDetails.starts_at.desc(), ContentItem.id.desc()]

    total = db.session.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.session.scalars(
        stmt.options(
            selectinload(ContentItem.cover), selectinload(ContentItem.author), selectinload(ContentItem.event)
        )
        .order_by(*order)
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()
    ids = [i.id for i in items]
    likes, comments = interaction_counts(ids)
    liked = liked_set(ids, visitor_hash())
    return ok([serialize_summary(i, likes, comments, liked) for i in items], meta=page_meta(page, per_page, total))


@bp.get("/content/<ctype>/<int:content_id>")
def content_detail(ctype: str, content_id: int):
    item = _published(content_id)
    if item.type != ctype:
        raise not_found("This content is not available.")
    data = serialize_detail(item, visitor_hash())
    related = db.session.scalars(
        select(ContentItem)
        .where(ContentItem.type == item.type, ContentItem.status == "published", ContentItem.id != item.id)
        .order_by(ContentItem.published_at.desc())
        .limit(3)
    ).all()
    rids = [r.id for r in related]
    likes, comments = interaction_counts(rids)
    data["related"] = [serialize_summary(r, likes, comments, set()) for r in related]
    return ok(data)


# --- Likes -----------------------------------------------------------------------


def _like_state(content_id: int, visitor: str) -> dict:
    count = db.session.scalar(select(func.count()).select_from(Like).where(Like.content_id == content_id))
    liked = db.session.scalar(
        select(func.count()).select_from(Like).where(Like.content_id == content_id, Like.visitor_hash == visitor)
    )
    return {"like_count": count, "liked": bool(liked)}


@bp.post("/content/<int:content_id>/like")
@limiter.limit("30/minute;300/day")
def like(content_id: int):
    _published(content_id)
    visitor = visitor_hash(create=True)
    db.session.execute(
        insert(Like)
        .values(content_id=content_id, visitor_hash=visitor)
        .on_conflict_do_nothing(constraint="uq_likes_content_visitor")
    )
    db.session.commit()
    return ok(_like_state(content_id, visitor))


@bp.delete("/content/<int:content_id>/like")
@limiter.limit("30/minute;300/day")
def unlike(content_id: int):
    _published(content_id)
    visitor = visitor_hash(create=True)
    db.session.execute(Like.__table__.delete().where(Like.content_id == content_id, Like.visitor_hash == visitor))
    db.session.commit()
    return ok(_like_state(content_id, visitor))


# --- Comments --------------------------------------------------------------------


def _serialize_comment(c: Comment) -> dict:
    # Visitor text is returned as plain text; the frontend renders it as text, never HTML.
    return {"id": c.id, "author_name": c.author_name or "Anonymous", "body": c.body, "created_at": iso(c.created_at)}


@bp.get("/content/<int:content_id>/comments")
def list_comments(content_id: int):
    _published(content_id)
    page, per_page = pagination_args(default_per_page=20)
    base = select(Comment).where(Comment.content_id == content_id, Comment.status == "approved")
    total = db.session.scalar(select(func.count()).select_from(base.subquery()))
    rows = db.session.scalars(
        base.order_by(Comment.created_at.asc(), Comment.id).offset((page - 1) * per_page).limit(per_page)
    ).all()
    return ok([_serialize_comment(c) for c in rows], meta=page_meta(page, per_page, total))


class CommentIn(BaseModel):
    author_name: str = Field(default="", max_length=80)
    body: str = Field(min_length=1, max_length=10000)
    website: str = Field(default="", max_length=200)  # Honeypot: humans never see this field.


@bp.post("/content/<int:content_id>/comments")
@limiter.limit("5/minute;30/day")
def create_comment(content_id: int):
    _published(content_id)
    data = parse_body(CommentIn)
    require_approval = current_app.config["COMMENTS_REQUIRE_APPROVAL"]
    pending_message = "Thanks! Your comment will appear after a moderator approves it."

    if data.website.strip():
        return ok({"status": "pending", "message": pending_message}, status=201)

    body = data.body.replace("\r\n", "\n").strip()
    name = " ".join(data.author_name.split())
    fields = {}
    max_len = current_app.config["COMMENT_MAX_LENGTH"]
    if len(body) < 2:
        fields["body"] = "Write a comment of at least 2 characters."
    elif len(body) > max_len:
        fields["body"] = f"Comments can be at most {max_len} characters."
    elif len(URL_RE.findall(body)) > current_app.config["COMMENT_MAX_LINKS"]:
        fields["body"] = "Comments may contain only a couple of links."
    if any(ch in name for ch in "<>"):
        fields["author_name"] = "Names cannot contain < or >."
    if fields:
        raise ApiError(422, "validation_error", "Please correct the highlighted fields.", fields)

    visitor = visitor_hash(create=True)
    duplicate = db.session.scalar(
        select(Comment.id).where(
            Comment.content_id == content_id,
            Comment.visitor_hash == visitor,
            Comment.body == body,
            Comment.created_at > utcnow() - timedelta(minutes=30),
        )
    )
    if duplicate:
        raise ApiError(409, "duplicate", "You have already posted this comment.")

    comment = Comment(
        content_id=content_id,
        author_name=name,
        body=body,
        visitor_hash=visitor,
        status="pending" if require_approval else "approved",
    )
    db.session.add(comment)
    db.session.commit()
    if require_approval:
        return ok({"status": "pending", "message": pending_message}, status=201)
    return ok({"status": "approved", "message": "Your comment has been posted.", "comment": _serialize_comment(comment)}, status=201)


# --- Subscriptions ---------------------------------------------------------------


class SubscribeIn(BaseModel):
    email: str = Field(max_length=254)
    blogs: bool = True
    events: bool = True
    meetups: bool = True
    website: str = Field(default="", max_length=200)  # Honeypot.


@bp.post("/subscriptions")
@limiter.limit("5/minute;20/day")
def subscribe():
    if not subscriptions_available():
        raise ApiError(503, "unavailable", "Email updates are not available right now.")
    data = parse_body(SubscribeIn)
    # Same response whether or not the address exists, to avoid revealing subscribers.
    message = "Check your inbox for a confirmation link to complete your subscription."
    if data.website.strip():
        return ok({"message": message}, status=202)
    email = data.email.strip().lower()
    if not is_valid_email(email):
        raise ApiError(422, "validation_error", "Enter a valid email address.", {"email": "Enter a valid email address."})
    if not (data.blogs or data.events or data.meetups):
        raise ApiError(422, "validation_error", "Choose at least one kind of update.", {"preferences": "Choose at least one."})

    sub = db.session.scalar(select(Subscriber).where(Subscriber.email == email))
    if sub is None:
        sub = Subscriber(email=email, status="pending")
        db.session.add(sub)
    if sub.status != "active":
        sub.wants_blogs, sub.wants_events, sub.wants_meetups = data.blogs, data.events, data.meetups
        recently = sub.last_verification_sent_at and sub.last_verification_sent_at > utcnow() - timedelta(minutes=10)
        sub.status = "pending"
        db.session.flush()
        if not recently:
            queue_verification(sub)
    db.session.commit()
    return ok({"message": message}, status=202)


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=500)


@bp.post("/subscriptions/confirm")
@limiter.limit("20/minute")
def confirm_subscription():
    data = parse_body(TokenIn)
    payload = read_verify_token(data.token)
    sub = db.session.get(Subscriber, payload["id"]) if payload else None
    if sub is None or sub.email != payload.get("e"):
        raise ApiError(400, "invalid_token", "This confirmation link is invalid or has expired.")
    if sub.status != "active":
        sub.status, sub.confirmed_at, sub.unsubscribed_at = "active", utcnow(), None
        db.session.commit()
    return ok({"message": "Your subscription is confirmed. Thank you!"})


@bp.post("/subscriptions/unsubscribe")
@limiter.limit("20/minute")
def unsubscribe():
    data = parse_body(TokenIn)
    payload = read_unsubscribe_token(data.token)
    sub = db.session.get(Subscriber, payload["id"]) if payload else None
    if sub is None or sub.email != payload.get("e"):
        raise ApiError(400, "invalid_token", "This unsubscribe link is invalid.")
    if sub.status != "unsubscribed":
        sub.status, sub.unsubscribed_at = "unsubscribed", utcnow()
        db.session.commit()
    return ok({"message": "You have been unsubscribed and will not receive further emails."})
