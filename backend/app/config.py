"""Application configuration, read from environment variables."""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    return int(value) if value not in (None, "") else default


class Config:
    ENV_NAME = os.environ.get("APP_ENV", "development")

    SECRET_KEY = os.environ.get("SECRET_KEY", "")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Public origin of the site; used to build absolute links in emails.
    PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/")

    # Sessions (admin only).
    SESSION_COOKIE_NAME = "vglug_admin"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
    PERMANENT_SESSION_LIFETIME = timedelta(hours=env_int("ADMIN_SESSION_HOURS", 8))

    # Anonymous visitor cookie used only to de-duplicate likes.
    VISITOR_COOKIE_NAME = "vglug_vid"
    VISITOR_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)

    # Initial administrator (bootstrap only; must be changed on first login).
    INITIAL_ADMIN_USERNAME = os.environ.get("INITIAL_ADMIN_USERNAME", "vglug")
    INITIAL_ADMIN_PASSWORD = os.environ.get("INITIAL_ADMIN_PASSWORD", "vglug@123")

    # Local media storage.
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_IMAGE_BYTES = env_int("MAX_IMAGE_MB", 10) * 1024 * 1024
    MAX_VIDEO_BYTES = env_int("MAX_VIDEO_MB", 200) * 1024 * 1024
    MAX_CONTENT_LENGTH = max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES) + 1024 * 1024

    # Rate limiting.
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_ENABLED = env_bool("RATELIMIT_ENABLED", True)
    RATELIMIT_HEADERS_ENABLED = True
    TRUST_PROXY_HEADERS = env_int("TRUST_PROXY_COUNT", 0)

    # Comments.
    COMMENTS_REQUIRE_APPROVAL = env_bool("COMMENTS_REQUIRE_APPROVAL", True)
    COMMENT_MAX_LENGTH = env_int("COMMENT_MAX_LENGTH", 2000)
    COMMENT_MAX_LINKS = env_int("COMMENT_MAX_LINKS", 2)

    # Email.
    SUBSCRIPTIONS_ENABLED = env_bool("SUBSCRIPTIONS_ENABLED", True)
    EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "console")  # console | smtp | disabled
    EMAIL_FROM = os.environ.get("EMAIL_FROM", "")
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = env_int("SMTP_PORT", 587)
    SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_SECURITY = os.environ.get("SMTP_SECURITY", "starttls")  # starttls | ssl | none
    SMTP_TIMEOUT = env_int("SMTP_TIMEOUT", 20)
    EMAIL_MAX_ATTEMPTS = env_int("EMAIL_MAX_ATTEMPTS", 5)
    SUBSCRIPTION_TOKEN_MAX_AGE = env_int("SUBSCRIPTION_TOKEN_HOURS", 48) * 3600

    # Optional: serve the built React app from Flask (single-origin deployment).
    FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "")

    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")


class TestConfig(Config):
    ENV_NAME = "testing"
    TESTING = True
    SECRET_KEY = "test-secret-key-not-for-production"
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL", "")
    RATELIMIT_ENABLED = False
    EMAIL_BACKEND = "memory"
    SUBSCRIPTIONS_ENABLED = True
    COMMENTS_REQUIRE_APPROVAL = True
    PUBLIC_BASE_URL = "http://testserver"
