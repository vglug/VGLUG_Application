"""Serves locally stored media with access control and HTTP range support (for video)."""

from flask import Blueprint, abort, send_file
from sqlalchemy import or_, select

from .extensions import db
from .models import Media
from .security import current_admin
from .services.media_refs import is_media_public
from .services.storage import resolve_media_path

bp = Blueprint("media", __name__)


@bp.get("/media/<path:relative_path>")
def serve(relative_path: str):
    media = db.session.scalar(
        select(Media).where(or_(Media.relative_path == relative_path, Media.thumb_relative_path == relative_path))
    )
    if media is None or media.status != "ready":
        abort(404)
    is_admin = current_admin() is not None
    # Files used only by drafts (or by nothing yet) are visible to admins only.
    if not is_admin and not is_media_public(media.id):
        abort(404)
    path = resolve_media_path(relative_path)
    if path is None or not path.is_file():
        abort(404)
    mimetype = "image/webp" if relative_path == media.thumb_relative_path else media.mime_type
    response = send_file(path, mimetype=mimetype, conditional=True, max_age=0 if is_admin else 86400)
    response.headers["Cache-Control"] = "private, no-store" if is_admin else "public, max-age=86400"
    response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response.headers["Content-Disposition"] = "inline"
    return response
