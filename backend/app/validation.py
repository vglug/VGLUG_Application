import re
import unicodedata
from urllib.parse import urlsplit

from flask import request
from pydantic import BaseModel, ValidationError

from .errors import ApiError

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
INTERNAL_PATH_RE = re.compile(r"^/[A-Za-z0-9\-._~/]*(?:#[A-Za-z0-9\-_]+)?$")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9-]{1,63})+$")


def slugify(value: str, max_length: int = 120) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value[:max_length].strip("-") or "item"


def is_safe_external_url(url: str, allow_mailto: bool = False) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    if allow_mailto and parts.scheme == "mailto":
        return EMAIL_RE.match(parts.path or "") is not None
    return parts.scheme in {"http", "https"} and bool(parts.netloc) and " " not in url


def is_safe_internal_path(url: str) -> bool:
    return bool(INTERNAL_PATH_RE.match(url)) and "//" not in url and ".." not in url


def check_link(url: str, *, allow_internal: bool = True, allow_mailto: bool = False) -> str | None:
    """Return an error message, or None when the link is acceptable."""
    url = url.strip()
    if not url:
        return "A destination is required."
    if len(url) > 500:
        return "Links must be at most 500 characters."
    if url.startswith("/"):
        if allow_internal and is_safe_internal_path(url):
            return None
        return "Internal links must be a site path like /about."
    if is_safe_external_url(url, allow_mailto=allow_mailto):
        return None
    return "Use a full http(s) URL" + (", a mailto: address" if allow_mailto else "") + (
        " or a site path starting with /." if allow_internal else "."
    )


def optional_external_url(value: str, field: str, errors: dict, allow_mailto: bool = False):
    value = (value or "").strip()
    if value and not is_safe_external_url(value, allow_mailto=allow_mailto):
        errors[field] = "Enter a full URL starting with https:// or http://."
    return value


def is_valid_email(value: str) -> bool:
    return len(value) <= 254 and EMAIL_RE.match(value) is not None


def parse_body(model: type[BaseModel]) -> BaseModel:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ApiError(400, "invalid_json", "Expected a JSON object.")
    try:
        return model.model_validate(payload)
    except ValidationError as e:
        fields = {}
        for err in e.errors():
            loc = ".".join(str(p) for p in err["loc"]) or "body"
            msg = err["msg"].removeprefix("Value error, ")
            fields.setdefault(loc, msg)
        raise ApiError(422, "validation_error", "Please correct the highlighted fields.", fields)


def fail(fields: dict, message: str = "Please correct the highlighted fields."):
    raise ApiError(422, "validation_error", message, fields)


def pagination_args(default_per_page: int = 12, max_per_page: int = 50) -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(max_per_page, max(1, int(request.args.get("per_page", default_per_page))))
    except ValueError:
        raise ApiError(400, "bad_request", "page and per_page must be integers.")
    return page, per_page


def page_meta(page: int, per_page: int, total: int) -> dict:
    return {"page": page, "per_page": per_page, "total": total, "pages": max(1, -(-total // per_page))}
