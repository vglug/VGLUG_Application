import logging
from pathlib import Path

from flask import Flask, abort, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import BASE_DIR, Config


def create_app(config_object: type[Config] | None = None) -> Flask:
    from .api import admin_auth, admin_community, admin_content, admin_media, admin_site, public
    from .cli import register_cli
    from .errors import register_error_handlers
    from .extensions import db, limiter, migrate
    from .media_routes import bp as media_bp
    from .security import attach_visitor_cookie, require_api_header

    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_object or Config)

    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY is not set. Copy backend/.env.example to backend/.env and configure it.")
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL (or TEST_DATABASE_URL for tests) is not set.")

    logging.basicConfig(level=app.config["LOG_LEVEL"], format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if app.config["TRUST_PROXY_HEADERS"]:
        n = app.config["TRUST_PROXY_HEADERS"]
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=n, x_proto=n, x_host=n)

    db.init_app(app)
    migrate.init_app(app, db, directory=str(BASE_DIR / "migrations"))
    limiter.init_app(app)

    for blueprint in (
        public.bp,
        admin_auth.bp,
        admin_content.bp,
        admin_site.bp,
        admin_media.bp,
        admin_community.bp,
        media_bp,
    ):
        app.register_blueprint(blueprint)

    register_error_handlers(app)
    register_cli(app)

    app.before_request(require_api_header)

    @app.after_request
    def finalize(response):
        attach_visitor_cookie(response)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if response.mimetype == "application/json":
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    _serve_frontend(app)
    return app


def _serve_frontend(app: Flask):
    """Optionally serve the built React app (single-origin deployment)."""
    dist = app.config["FRONTEND_DIST"]
    if not dist:
        return
    root = Path(dist).resolve()

    csp = (
        "default-src 'self'; img-src 'self' data: https:; media-src 'self'; style-src 'self' 'unsafe-inline'; "
        "font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; "
        "form-action 'self'; object-src 'none'"
    )

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def spa(path: str):
        if path.startswith(("api/", "media/")):
            abort(404)
        candidate = (root / path).resolve()
        if path and root in candidate.parents and candidate.is_file():
            response = send_from_directory(root, path, max_age=31536000 if path.startswith("assets/") else 0)
        else:
            response = send_from_directory(root, "index.html", max_age=0)
        response.headers["Content-Security-Policy"] = csp
        return response
