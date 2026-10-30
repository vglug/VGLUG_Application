import logging

from flask import Blueprint
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..errors import ApiError, ok
from ..extensions import db, limiter
from ..models import Admin, utcnow
from ..security import (
    admin_required,
    csrf_token,
    current_admin,
    end_admin_session,
    hash_password,
    start_admin_session,
    validate_new_password,
    verify_password,
)
from ..validation import fail, parse_body

bp = Blueprint("admin_auth", __name__, url_prefix="/api/admin/auth")
log = logging.getLogger(__name__)


def serialize_admin(admin: Admin) -> dict:
    return {
        "id": admin.id,
        "username": admin.username,
        "display_name": admin.display_name,
        "role": admin.role,
        "must_change_password": admin.must_change_password,
    }


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


@bp.post("/login")
@limiter.limit("5/minute;30/hour")
def login():
    data = parse_body(LoginIn)
    admin = db.session.scalar(select(Admin).where(Admin.username == data.username.strip().lower()))
    if not verify_password(admin, data.password) or not admin.is_active:
        log.info("Failed admin login attempt")
        raise ApiError(401, "invalid_credentials", "Incorrect username or password.")
    admin.last_login_at = utcnow()
    db.session.commit()
    token = start_admin_session(admin)
    return ok({"admin": serialize_admin(admin), "csrf_token": token})


@bp.post("/logout")
def logout():
    end_admin_session()
    return ok({"message": "Signed out."})


@bp.get("/me")
def me():
    admin = current_admin()
    if admin is None:
        raise ApiError(401, "unauthorized", "Not signed in.")
    return ok({"admin": serialize_admin(admin), "csrf_token": csrf_token()})


class PasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)
    display_name: str | None = Field(default=None, max_length=120)


@bp.post("/password")
@limiter.limit("5/minute")
@admin_required(allow_password_change_pending=True)
def change_password():
    admin = current_admin()
    data = parse_body(PasswordIn)
    if not verify_password(admin, data.current_password):
        fail({"current_password": "The current password is incorrect."})
    problems = validate_new_password(data.new_password, admin.username)
    if data.new_password == data.current_password:
        problems.append("The new password must be different from the current one.")
    if problems:
        fail({"new_password": " ".join(problems)})
    admin.password_hash = hash_password(data.new_password)
    admin.must_change_password = False
    admin.session_version += 1
    if data.display_name is not None:
        admin.display_name = data.display_name.strip()
    db.session.commit()
    token = start_admin_session(admin)
    return ok({"admin": serialize_admin(admin), "csrf_token": token})
