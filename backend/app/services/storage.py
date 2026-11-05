"""Persistent local-server media storage. No cloud providers are used."""

import logging
import os
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from ..errors import ApiError
from ..extensions import db
from ..models import Media

log = logging.getLogger(__name__)

CATEGORIES = ("blogs", "events", "meetups", "join-us", "footer", "pages")

# Detected type -> (mime, kind, allowed extensions, canonical extension)
FILE_TYPES = {
    "jpeg": ("image/jpeg", "image", {"jpg", "jpeg"}, "jpg"),
    "png": ("image/png", "image", {"png"}, "png"),
    "gif": ("image/gif", "image", {"gif"}, "gif"),
    "webp": ("image/webp", "image", {"webp"}, "webp"),
    "mp4": ("video/mp4", "video", {"mp4", "m4v"}, "mp4"),
    "webm": ("video/webm", "video", {"webm"}, "webm"),
}
THUMB_WIDTH = 800
Image.MAX_IMAGE_PIXELS = 60_000_000  # Decompression-bomb guard.


@dataclass
class StoredFile:
    relative_path: str
    stored_filename: str
    mime_type: str
    kind: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    thumb_relative_path: str | None = None


def upload_root() -> Path:
    root = Path(current_app.config["UPLOAD_FOLDER"])
    if not root.is_absolute():
        root = Path(current_app.root_path).parent / root
    return root.resolve()


def detect_type(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[4:8] == b"ftyp":
        return "mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"
    return None


def resolve_media_path(relative_path: str) -> Path | None:
    """Map a stored relative path to an absolute path, refusing anything outside the root."""
    root = upload_root()
    candidate = (root / relative_path).resolve()
    if root not in candidate.parents:
        return None
    return candidate


def save_upload(file: FileStorage, category: str) -> StoredFile:
    if category not in CATEGORIES:
        raise ApiError(422, "validation_error", "Unknown media category.", {"category": "Invalid category."})
    if not file or not file.filename:
        raise ApiError(422, "validation_error", "Choose a file to upload.", {"file": "A file is required."})

    original = secure_filename(file.filename) or "upload"
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    head = file.stream.read(16)
    file.stream.seek(0)
    detected = detect_type(head)
    if detected is None:
        raise ApiError(415, "unsupported_media", "Only JPEG, PNG, GIF, WebP, MP4 and WebM files are allowed.")
    mime, kind, allowed_exts, canonical_ext = FILE_TYPES[detected]
    if ext not in allowed_exts:
        raise ApiError(415, "unsupported_media", "The file extension does not match its contents.")

    limit = current_app.config["MAX_IMAGE_BYTES" if kind == "image" else "MAX_VIDEO_BYTES"]
    directory = upload_root() / category
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except OSError:
        log.exception("Cannot create upload directory")
        raise ApiError(500, "storage_failed", "Media storage is not available. The file was not saved.")

    stored_name = f"{uuid.uuid4().hex}.{canonical_ext}"
    final_path = directory / stored_name
    tmp_path = directory / f".{stored_name}.part"
    size = 0
    try:
        with open(tmp_path, "wb") as out:
            while chunk := file.stream.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ApiError(
                        413, "payload_too_large", f"{kind.title()}s must be at most {limit // (1024 * 1024)} MB."
                    )
                out.write(chunk)
            out.flush()
            os.fsync(out.fileno())

        stored = StoredFile(
            relative_path=f"{category}/{stored_name}",
            stored_filename=stored_name,
            mime_type=mime,
            kind=kind,
            size_bytes=size,
        )
        if kind == "image":
            _inspect_image(tmp_path, stored, directory)
        os.replace(tmp_path, final_path)
        return stored
    except ApiError:
        _silent_unlink(tmp_path)
        raise
    except OSError:
        _silent_unlink(tmp_path)
        log.exception("Failed to write upload")
        raise ApiError(500, "storage_failed", "The file could not be stored. Nothing was saved.")


def _inspect_image(path: Path, stored: StoredFile, directory: Path):
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)
            stored.width, stored.height = img.size
            if stored.mime_type != "image/gif" and img.width > THUMB_WIDTH:
                thumb = img.copy()
                thumb.thumbnail((THUMB_WIDTH, THUMB_WIDTH * 4))
                if thumb.mode not in ("RGB", "RGBA"):
                    thumb = thumb.convert("RGBA" if "A" in thumb.getbands() else "RGB")
                thumb_name = stored.stored_filename.rsplit(".", 1)[0] + "_thumb.webp"
                thumb.save(directory / thumb_name, "WEBP", quality=82)
                stored.thumb_relative_path = stored.relative_path.rsplit("/", 1)[0] + "/" + thumb_name
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise ApiError(415, "unsupported_media", "The image appears to be corrupt or unsupported.")


def delete_stored_files(media: Media):
    for rel in (media.relative_path, media.thumb_relative_path):
        if rel:
            path = resolve_media_path(rel)
            if path:
                _silent_unlink(path)


def create_media_record(stored: StoredFile, *, category: str, original_filename: str, admin_id: int,
                        alt_text: str = "", caption: str = "") -> Media:
    """Persist metadata; if the database write fails the stored files are removed."""
    media = Media(
        storage_provider="local",
        category=category,
        relative_path=stored.relative_path,
        thumb_relative_path=stored.thumb_relative_path,
        stored_filename=stored.stored_filename,
        original_filename=(secure_filename(original_filename) or "upload")[:255],
        mime_type=stored.mime_type,
        kind=stored.kind,
        size_bytes=stored.size_bytes,
        width=stored.width,
        height=stored.height,
        alt_text=alt_text[:300],
        caption=caption[:500],
        uploaded_by_id=admin_id,
        status="ready",
    )
    try:
        db.session.add(media)
        db.session.commit()
    except Exception:
        db.session.rollback()
        delete_stored_files(media)
        raise
    return media


def storage_status() -> dict:
    root = upload_root()
    usage = None
    try:
        root.mkdir(parents=True, exist_ok=True)
        du = shutil.disk_usage(root)
        usage = {"total_bytes": du.total, "used_bytes": du.used, "free_bytes": du.free}
        writable = os.access(root, os.W_OK)
    except OSError:
        writable = False
    return {"provider": "local", "writable": writable, "disk": usage}


def _silent_unlink(path: Path):
    try:
        path.unlink(missing_ok=True)
    except OSError:
        log.warning("Could not remove file %s", path.name)
