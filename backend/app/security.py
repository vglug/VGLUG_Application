"""Admin authentication, CSRF protection and anonymous visitor identity."""

import hashlib
import hmac
import secrets
from functools import wraps

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from flask import current_app, g, request, session

from .errors import ApiError
from .extensions import db
from .models import Admin

_hasher = PasswordHasher()
# Used to equalise timing when the username does not exist.
_DUMMY_HASH = _hasher.hash("timing-equaliser-not-a-real-password")

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(admin: Admin | None, password: str) -> bool:
    if admin is None:
        try:
            _hasher.verify(_DUMMY_HASH, password)
        except VerificationError:
            pass
        return False
    try:
        _hasher.verify(admin.password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    if _hasher.check_needs_rehash(admin.password_hash):
        admin.password_hash = _hasher.hash(password)
    return True


def validate_new_password(password: str, username: str) -> list[str]:
    problems = []
    if len(password) < 12:
        problems.append("Use at least 12 characters.")
    if len(password) > 256:
        problems.append("Use at most 256 characters.")
    classes = sum(
        [
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        ]
    )
    if classes < 3:
        problems.append("Mix at least three of: lowercase, uppercase, digits, symbols.")
    lowered = password.lower()
    if username.lower() in lowered or lowered in {current_app.config["INITIAL_ADMIN_PASSWORD"].lower()}:
        problems.append("Do not reuse the username or the initial password.")
    return problems


# --- Sessions -----------------------------------------------------------------


def start_admin_session(admin: Admin) -> str:
    session.clear()
    session.permanent = True
    session["admin_id"] = admin.id
    session["sv"] = admin.session_version
    session["csrf"] = secrets.token_urlsafe(32)
    return session["csrf"]


def end_admin_session():
    session.clear()


def current_admin() -> Admin | None:
    if "current_admin" in g:
        return g.current_admin
    admin = None
    admin_id = session.get("admin_id")
    if admin_id:
        candidate = db.session.get(Admin, admin_id)
        if candidate and candidate.is_active and candidate.session_version == session.get("sv"):
            admin = candidate
        else:
            session.clear()
    g.current_admin = admin
    return admin


def csrf_token() -> str:
    token = session.get("csrf")
    if not token:
        token = session["csrf"] = secrets.token_urlsafe(32)
    return token


def check_csrf():
    expected = session.get("csrf")
    supplied = request.headers.get("X-CSRF-Token", "")
    if not expected or not hmac.compare_digest(expected, supplied):
        raise ApiError(403, "csrf_failed", "Your session security token is missing or expired. Reload and try again.")


def admin_required(allow_password_change_pending: bool = False):
    """Protect an admin endpoint. Enforced on the server for every protected action."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            admin = current_admin()
            if admin is None:
                raise ApiError(401, "unauthorized", "Please sign in as an administrator.")
            if request.method in UNSAFE_METHODS:
                check_csrf()
            if admin.must_change_password and not allow_password_change_pending:
                raise ApiError(403, "password_change_required", "Change the initial password before continuing.")
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_api_header():
    """Per-request setup plus a cheap cross-site request defence for every unsafe /api call.

    Browsers cannot attach custom headers to cross-origin requests without a CORS
    preflight, which this API never approves.
    """
    g.pop("current_admin", None)
    if request.method in UNSAFE_METHODS and request.path.startswith("/api/"):
        if request.headers.get("X-Requested-With") != "fetch":
            raise ApiError(403, "bad_origin", "Request rejected.")


# --- Anonymous visitors ------------------------------------------------------


def visitor_hash(create: bool = False) -> str | None:
    """Return a keyed hash of the visitor cookie, optionally issuing a new cookie."""
    name = current_app.config["VISITOR_COOKIE_NAME"]
    raw = request.cookies.get(name, "")
    if not (20 <= len(raw) <= 100):
        if not create:
            return None
        raw = secrets.token_urlsafe(32)
        g.new_visitor_cookie = raw
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, f"visitor:{raw}".encode(), hashlib.sha256).hexdigest()


def attach_visitor_cookie(response):
    raw = g.pop("new_visitor_cookie", None)
    if raw:
        response.set_cookie(
            current_app.config["VISITOR_COOKIE_NAME"],
            raw,
            max_age=60 * 60 * 24 * 365,
            httponly=True,
            samesite="Lax",
            secure=current_app.config["VISITOR_COOKIE_SECURE"],
        )
    return response
