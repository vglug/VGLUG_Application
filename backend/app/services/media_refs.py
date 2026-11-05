"""Tracks where each media file is used.

References drive three things: public access control (a file is only served to
anonymous visitors when something published uses it), orphan detection, and safe
cleanup when content or media is deleted or replaced.
"""

from datetime import timedelta

from sqlalchemy import exists, or_, select

from ..extensions import db
from ..models import ContentItem, ContentMedia, FooterSettings, Media, PageMedia, SitePage, utcnow
from .markdown import extract_media_paths
from .storage import delete_stored_files


def media_url(relative_path: str | None) -> str | None:
    return f"/media/{relative_path}" if relative_path else None


def serialize_media(m: Media | None) -> dict | None:
    if m is None:
        return None
    return {
        "id": m.id,
        "url": media_url(m.relative_path),
        "thumb_url": media_url(m.thumb_relative_path) or media_url(m.relative_path),
        "kind": m.kind,
        "mime_type": m.mime_type,
        "width": m.width,
        "height": m.height,
        "alt_text": m.alt_text,
        "caption": m.caption,
    }


def serialize_media_admin(m: Media) -> dict:
    data = serialize_media(m)
    data.update(
        category=m.category,
        original_filename=m.original_filename,
        size_bytes=m.size_bytes,
        created_at=m.created_at.isoformat() if m.created_at else None,
        reference_count=len(references(m.id)),
    )
    return data


def _media_by_paths(paths: set[str]) -> list[Media]:
    if not paths:
        return []
    return db.session.scalars(select(Media).where(Media.relative_path.in_(paths))).all()


def sync_content_media(item: ContentItem, gallery_ids: list[int] | None = None):
    """Link files referenced in the body, and optionally replace the gallery selection."""
    referenced = {m.id for m in _media_by_paths(extract_media_paths(item.body_md))}
    links = {link.media_id: link for link in item.media_links}

    if gallery_ids is not None:
        valid = set(db.session.scalars(select(Media.id).where(Media.id.in_(gallery_ids))).all()) if gallery_ids else set()
        for position, media_id in enumerate(mid for mid in gallery_ids if mid in valid):
            link = links.get(media_id)
            if link is None:
                link = ContentMedia(media_id=media_id)
                item.media_links.append(link)
                links[media_id] = link
            link.in_gallery = True
            link.position = position
        for media_id, link in links.items():
            if media_id not in valid:
                link.in_gallery = False

    for media_id in referenced - set(links):
        link = ContentMedia(media_id=media_id, in_gallery=False, position=1000)
        item.media_links.append(link)
        links[media_id] = link

    for media_id, link in list(links.items()):
        if not link.in_gallery and media_id not in referenced:
            item.media_links.remove(link)


def sync_page_media(page: SitePage):
    texts = [page.intro_md] + [s.body_md for s in page.sections]
    for s in page.sections:
        texts.extend(str(i.get("body_md", "")) for i in (s.items or []) if isinstance(i, dict))
    wanted = {m.id for m in _media_by_paths(extract_media_paths(*texts))}
    db.session.execute(PageMedia.__table__.delete().where(PageMedia.page_id == page.id))
    for media_id in wanted:
        db.session.add(PageMedia(page_id=page.id, media_id=media_id))


def references(media_id: int) -> list[dict]:
    refs = []
    for item in db.session.scalars(select(ContentItem).where(ContentItem.cover_media_id == media_id)):
        refs.append({"kind": item.type, "id": item.id, "title": item.title, "usage": "cover"})
    rows = db.session.execute(
        select(ContentItem.id, ContentItem.type, ContentItem.title)
        .join(ContentMedia, ContentMedia.content_id == ContentItem.id)
        .where(ContentMedia.media_id == media_id)
    )
    for cid, ctype, title in rows:
        refs.append({"kind": ctype, "id": cid, "title": title, "usage": "attachment"})
    for page in db.session.scalars(
        select(SitePage).join(PageMedia, PageMedia.page_id == SitePage.id).where(PageMedia.media_id == media_id)
    ):
        refs.append({"kind": "page", "id": page.key, "title": page.title, "usage": "page"})
    footer = db.session.get(FooterSettings, 1)
    if footer and footer.donation_qr_media_id == media_id:
        refs.append({"kind": "footer", "id": 1, "title": "Footer", "usage": "donation QR code"})
    return refs


def is_media_public(media_id: int) -> bool:
    published_content = (
        select(ContentItem.id)
        .outerjoin(ContentMedia, ContentMedia.content_id == ContentItem.id)
        .where(ContentItem.status == "published")
        .where(or_(ContentItem.cover_media_id == media_id, ContentMedia.media_id == media_id))
    )
    published_page = (
        select(SitePage.id)
        .join(PageMedia, PageMedia.page_id == SitePage.id)
        .where(SitePage.status == "published", PageMedia.media_id == media_id)
    )
    footer = select(FooterSettings.id).where(FooterSettings.donation_qr_media_id == media_id)
    return db.session.scalar(select(exists(published_content) | exists(published_page) | exists(footer)))


def orphan_query(min_age: timedelta = timedelta(hours=1)):
    """Media used nowhere. A grace period protects files uploaded for an unsaved draft."""
    return (
        select(Media)
        .where(Media.created_at < utcnow() - min_age)
        .where(~exists().where(ContentItem.cover_media_id == Media.id))
        .where(~exists().where(ContentMedia.media_id == Media.id))
        .where(~exists().where(PageMedia.media_id == Media.id))
        .where(~exists().where(FooterSettings.donation_qr_media_id == Media.id))
        .order_by(Media.created_at)
    )


def delete_media(media: Media):
    """Delete the metadata row, then the files. Files are removed only after commit succeeds."""
    db.session.delete(media)
    db.session.commit()
    delete_stored_files(media)


def delete_if_unreferenced(media_ids: set[int]) -> int:
    removed = 0
    for media_id in media_ids:
        media = db.session.get(Media, media_id)
        if media and not references(media_id):
            delete_media(media)
            removed += 1
    return removed
