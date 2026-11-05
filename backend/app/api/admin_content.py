from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from ..errors import not_found, ok
from ..extensions import db
from ..models import CONTENT_TYPES, ContentItem, EventDetails, Media, utcnow
from ..security import admin_required, current_admin
from ..services.content import serialize_admin
from ..services.markdown import render_markdown
from ..services.media_refs import delete_if_unreferenced, sync_content_media
from ..services.notifications import queue_announcement
from ..validation import SLUG_RE, check_link, fail, page_meta, pagination_args, parse_body, slugify

bp = Blueprint("admin_content", __name__, url_prefix="/api/admin")


class EventIn(BaseModel):
    starts_local: datetime
    ends_local: datetime | None = None
    timezone: str = Field(default="Asia/Kolkata", max_length=64)
    location_name: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=500)
    is_online: bool = False
    online_url: str = Field(default="", max_length=500)
    registration_url: str = Field(default="", max_length=500)
    registration_info: str = Field(default="", max_length=1000)
    event_status: Literal["scheduled", "postponed", "cancelled", "completed"] = "scheduled"


class ContentIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=500)
    body_md: str = Field(default="", max_length=200_000)
    status: Literal["draft", "published", "archived"] = "draft"
    cover_media_id: int | None = None
    gallery_ids: list[int] = Field(default_factory=list, max_length=50)
    event: EventIn | None = None


def _check_type(ctype: str):
    if ctype not in CONTENT_TYPES:
        raise not_found("Unknown content type.")


def _get_item(ctype: str, content_id: int) -> ContentItem:
    _check_type(ctype)
    item = db.session.get(ContentItem, content_id)
    if item is None or item.type != ctype:
        raise not_found("Content not found.")
    return item


def _event_local(item: ContentItem) -> dict | None:
    ev = item.event
    if ev is None:
        return None
    tz = ZoneInfo(ev.timezone)
    fmt = "%Y-%m-%dT%H:%M"
    return {
        "starts_local": ev.starts_at.astimezone(tz).strftime(fmt),
        "ends_local": ev.ends_at.astimezone(tz).strftime(fmt) if ev.ends_at else None,
        "timezone": ev.timezone,
        "location_name": ev.location_name,
        "address": ev.address,
        "is_online": ev.is_online,
        "online_url": ev.online_url,
        "registration_url": ev.registration_url,
        "registration_info": ev.registration_info,
        "event_status": ev.event_status,
    }


def _admin_payload(item: ContentItem) -> dict:
    data = serialize_admin(item)
    data["event_form"] = _event_local(item)
    return data


def _apply(item: ContentItem, data: ContentIn):
    errors = {}
    title = " ".join(data.title.split())
    slug = (data.slug.strip().lower() or slugify(title))[:200]
    if not SLUG_RE.match(slug):
        errors["slug"] = "Use lowercase letters, numbers and single hyphens only."
    else:
        clash = db.session.scalar(
            select(ContentItem.id).where(ContentItem.type == item.type, ContentItem.slug == slug, ContentItem.id != item.id)
        )
        if clash:
            errors["slug"] = "Another item already uses this slug."

    if data.cover_media_id is not None:
        cover = db.session.get(Media, data.cover_media_id)
        if cover is None or cover.kind != "image":
            errors["cover_media_id"] = "Choose an uploaded image as the cover."

    if data.status == "published":
        if len(data.body_md.strip()) < 20:
            errors["body_md"] = "Write at least a short body before publishing."

    event_values = None
    if item.type in ("event", "meetup"):
        ev = data.event
        if ev is None:
            errors["event.starts_local"] = "Start date and time are required."
        else:
            try:
                tz = ZoneInfo(ev.timezone)
            except (ZoneInfoNotFoundError, ValueError):
                errors["event.timezone"] = "Choose a valid time zone."
                tz = None
            for field in ("online_url", "registration_url"):
                value = getattr(ev, field).strip()
                if value and (msg := check_link(value, allow_internal=False)):
                    errors[f"event.{field}"] = msg
            if ev.is_online and not ev.online_url.strip() and not ev.location_name.strip():
                errors["event.online_url"] = "Add an online meeting link or a location."
            if tz:
                starts = ev.starts_local.replace(tzinfo=tz) if ev.starts_local.tzinfo is None else ev.starts_local
                ends = None
                if ev.ends_local:
                    ends = ev.ends_local.replace(tzinfo=tz) if ev.ends_local.tzinfo is None else ev.ends_local
                    if ends < starts:
                        errors["event.ends_local"] = "The end must be after the start."
                event_values = dict(
                    starts_at=starts.astimezone(timezone.utc),
                    ends_at=ends.astimezone(timezone.utc) if ends else None,
                    timezone=ev.timezone,
                    location_name=ev.location_name.strip(),
                    address=ev.address.strip(),
                    is_online=ev.is_online,
                    online_url=ev.online_url.strip(),
                    registration_url=ev.registration_url.strip(),
                    registration_info=ev.registration_info.strip(),
                    event_status=ev.event_status,
                )

    if errors:
        fail(errors)

    admin = current_admin()
    db.session.add(item)
    item.title = title
    item.slug = slug
    item.summary = data.summary.strip()
    item.body_md = data.body_md
    item.cover_media_id = data.cover_media_id
    item.updated_by_id = admin.id
    if event_values:
        if item.event is None:
            item.event = EventDetails(**event_values)
        else:
            for key, value in event_values.items():
                setattr(item.event, key, value)

    was_published = item.status == "published"
    item.status = data.status
    if data.status == "published" and not was_published and item.published_at is None:
        item.published_at = utcnow()

    sync_content_media(item, data.gallery_ids)
    db.session.flush()
    if item.status == "published":
        queue_announcement(item)


@bp.get("/content/<ctype>")
@admin_required()
def list_items(ctype: str):
    _check_type(ctype)
    page, per_page = pagination_args(default_per_page=20, max_per_page=100)
    stmt = select(ContentItem).where(ContentItem.type == ctype)
    status = request.args.get("status")
    if status in ("draft", "published", "archived"):
        stmt = stmt.where(ContentItem.status == status)
    q = (request.args.get("q") or "").strip()[:100]
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(or_(ContentItem.title.ilike(like), ContentItem.slug.ilike(like)))
    total = db.session.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.session.scalars(
        stmt.options(selectinload(ContentItem.event), selectinload(ContentItem.cover), selectinload(ContentItem.author))
        .order_by(ContentItem.updated_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()
    return ok([_admin_payload(i) for i in items], meta=page_meta(page, per_page, total))


@bp.get("/content/<ctype>/<int:content_id>")
@admin_required()
def get_item(ctype: str, content_id: int):
    return ok(_admin_payload(_get_item(ctype, content_id)))


@bp.post("/content/<ctype>")
@admin_required()
def create_item(ctype: str):
    _check_type(ctype)
    data = parse_body(ContentIn)
    item = ContentItem(type=ctype, author_id=current_admin().id)
    _apply(item, data)
    db.session.commit()
    return ok(_admin_payload(item), status=201)


@bp.put("/content/<ctype>/<int:content_id>")
@admin_required()
def update_item(ctype: str, content_id: int):
    item = _get_item(ctype, content_id)
    previous_media = {item.cover_media_id} | {link.media_id for link in item.media_links}
    _apply(item, parse_body(ContentIn))
    db.session.commit()
    # Files that were replaced and are no longer used anywhere are cleaned up.
    current = {item.cover_media_id} | {link.media_id for link in item.media_links}
    delete_if_unreferenced({m for m in previous_media - current if m})
    return ok(_admin_payload(item))


@bp.delete("/content/<ctype>/<int:content_id>")
@admin_required()
def delete_item(ctype: str, content_id: int):
    item = _get_item(ctype, content_id)
    media_ids = {item.cover_media_id} | {link.media_id for link in item.media_links}
    db.session.delete(item)
    db.session.commit()
    removed = delete_if_unreferenced({m for m in media_ids if m})
    return ok({"deleted": content_id, "media_removed": removed})


class PreviewIn(BaseModel):
    markdown: str = Field(default="", max_length=200_000)


@bp.post("/markdown/preview")
@admin_required()
def preview():
    data = parse_body(PreviewIn)
    return ok({"html": render_markdown(data.markdown)})
