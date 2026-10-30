from flask import Blueprint, request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from ..errors import ApiError, not_found, ok
from ..extensions import db
from ..models import Media
from ..security import admin_required, current_admin
from ..services.media_refs import delete_media, orphan_query, references, serialize_media_admin
from ..services.storage import CATEGORIES, create_media_record, save_upload, storage_status
from ..validation import page_meta, pagination_args, parse_body

bp = Blueprint("admin_media", __name__, url_prefix="/api/admin/media")


@bp.get("")
@admin_required()
def list_media():
    page, per_page = pagination_args(default_per_page=24, max_per_page=100)
    stmt = select(Media)
    category = request.args.get("category")
    if category in CATEGORIES:
        stmt = stmt.where(Media.category == category)
    kind = request.args.get("kind")
    if kind in ("image", "video"):
        stmt = stmt.where(Media.kind == kind)
    total = db.session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.session.scalars(stmt.order_by(Media.created_at.desc()).offset((page - 1) * per_page).limit(per_page)).all()
    return ok([serialize_media_admin(m) for m in rows], meta=page_meta(page, per_page, total))


@bp.post("")
@admin_required()
def upload():
    file = request.files.get("file")
    category = request.form.get("category", "")
    alt_text = (request.form.get("alt_text") or "").strip()
    caption = (request.form.get("caption") or "").strip()
    stored = save_upload(file, category)
    media = create_media_record(
        stored,
        category=category,
        original_filename=file.filename,
        admin_id=current_admin().id,
        alt_text=alt_text,
        caption=caption,
    )
    return ok(serialize_media_admin(media), status=201)


class MediaUpdateIn(BaseModel):
    alt_text: str = Field(default="", max_length=300)
    caption: str = Field(default="", max_length=500)


@bp.patch("/<int:media_id>")
@admin_required()
def update_media(media_id: int):
    media = db.session.get(Media, media_id)
    if media is None:
        raise not_found("Media not found.")
    data = parse_body(MediaUpdateIn)
    media.alt_text, media.caption = data.alt_text.strip(), data.caption.strip()
    db.session.commit()
    return ok(serialize_media_admin(media))


@bp.get("/<int:media_id>/references")
@admin_required()
def media_references(media_id: int):
    if db.session.get(Media, media_id) is None:
        raise not_found("Media not found.")
    return ok(references(media_id))


@bp.delete("/<int:media_id>")
@admin_required()
def remove_media(media_id: int):
    media = db.session.get(Media, media_id)
    if media is None:
        raise not_found("Media not found.")
    refs = references(media_id)
    if refs:
        raise ApiError(409, "in_use", "This file is still in use. Remove it from the listed places first.", {"references": refs})
    delete_media(media)
    return ok({"deleted": media_id})


@bp.get("/status")
@admin_required()
def status():
    by_category = db.session.execute(
        select(Media.category, func.count(), func.coalesce(func.sum(Media.size_bytes), 0)).group_by(Media.category)
    ).all()
    orphans = db.session.scalars(orphan_query()).all()
    return ok(
        {
            **storage_status(),
            "categories": [{"category": c, "files": n, "bytes": int(b)} for c, n, b in by_category],
            "total_files": sum(n for _, n, _ in by_category),
            "total_bytes": int(sum(b for _, _, b in by_category)),
            "orphans": {"files": len(orphans), "bytes": sum(m.size_bytes for m in orphans)},
        }
    )


@bp.post("/cleanup")
@admin_required()
def cleanup():
    removed = 0
    freed = 0
    for media in db.session.scalars(orphan_query()).all():
        size = media.size_bytes
        delete_media(media)
        removed += 1
        freed += size
    return ok({"removed": removed, "freed_bytes": freed})
