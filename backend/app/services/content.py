from datetime import timezone

from sqlalchemy import func, select

from ..extensions import db
from ..models import Comment, ContentItem, Like
from .markdown import plain_excerpt, render_markdown
from .media_refs import serialize_media

TYPE_PATHS = {"blog": "blogs", "event": "events", "meetup": "meetups"}


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat() if dt else None


def public_path(item: ContentItem) -> str:
    return f"/{TYPE_PATHS[item.type]}/{item.id}-{item.slug}"


def interaction_counts(ids: list[int]) -> tuple[dict[int, int], dict[int, int]]:
    if not ids:
        return {}, {}
    likes = dict(
        db.session.execute(
            select(Like.content_id, func.count()).where(Like.content_id.in_(ids)).group_by(Like.content_id)
        ).all()
    )
    comments = dict(
        db.session.execute(
            select(Comment.content_id, func.count())
            .where(Comment.content_id.in_(ids), Comment.status == "approved")
            .group_by(Comment.content_id)
        ).all()
    )
    return likes, comments


def liked_set(ids: list[int], visitor: str | None) -> set[int]:
    if not visitor or not ids:
        return set()
    return set(
        db.session.scalars(select(Like.content_id).where(Like.content_id.in_(ids), Like.visitor_hash == visitor))
    )


def serialize_event(item: ContentItem) -> dict | None:
    ev = item.event
    if ev is None:
        return None
    return {
        "starts_at": iso(ev.starts_at),
        "ends_at": iso(ev.ends_at),
        "timezone": ev.timezone,
        "location_name": ev.location_name,
        "address": ev.address,
        "is_online": ev.is_online,
        "online_url": ev.online_url,
        "registration_url": ev.registration_url,
        "registration_info": ev.registration_info,
        "event_status": ev.event_status,
    }


def serialize_summary(item: ContentItem, likes: dict, comments: dict, liked: set) -> dict:
    return {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "slug": item.slug,
        "path": public_path(item),
        "summary": item.summary or plain_excerpt(item.body_md),
        "author": item.author.public_name if item.author else "VGLUG",
        "published_at": iso(item.published_at),
        "updated_at": iso(item.updated_at),
        "cover": serialize_media(item.cover),
        "event": serialize_event(item),
        "like_count": likes.get(item.id, 0),
        "comment_count": comments.get(item.id, 0),
        "liked": item.id in liked,
    }


def serialize_detail(item: ContentItem, visitor: str | None) -> dict:
    likes, comments = interaction_counts([item.id])
    data = serialize_summary(item, likes, comments, liked_set([item.id], visitor))
    data["body_html"] = render_markdown(item.body_md)
    data["gallery"] = [serialize_media(link.media) for link in item.media_links if link.in_gallery]
    return data


def serialize_admin(item: ContentItem) -> dict:
    likes, comments = interaction_counts([item.id])
    data = serialize_summary(item, likes, comments, set())
    data.update(
        status=item.status,
        body_md=item.body_md,
        summary=item.summary,
        created_at=iso(item.created_at),
        announced_at=iso(item.announced_at),
        gallery=[serialize_media(link.media) for link in item.media_links if link.in_gallery],
        pending_comments=db.session.scalar(
            select(func.count()).select_from(Comment).where(Comment.content_id == item.id, Comment.status == "pending")
        ),
    )
    return data
