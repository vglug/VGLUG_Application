# VGLUG Foundation Website

The website of the **Viluppuram GNU/Linux Users Group (VGLUG)**. It is built with a React frontend, a Flask REST API and PostgreSQL.

- **Visitors** can browse published blogs, events and meetups without an account. They can also like, comment on and share content, and subscribe to email updates.
- **Administrators** sign in at `/admin`. From there they can manage content, the Home/About/Join Us/Contact pages, navigation, footer, media, comments and subscribers.
- There is **no public registration, login, profile or account settings**. Only administrators can sign in.
- Uploaded media is stored **only on the server's local disk**. PostgreSQL holds the file metadata.

```
backend/    Flask API (uv, Flask-SQLAlchemy, Flask-Migrate/Alembic, Argon2, nh3)
frontend/   React (Vite, React Router)
```

## Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+ and npm
- PostgreSQL 14+ (or run `docker compose up -d db` to use the bundled Compose file)

## Setup

```bash
# 1. Database (skip if you already have PostgreSQL)
docker compose up -d db          # creates databases vglug and vglug_test

# 2. Backend
cd backend
cp .env.example .env             # then edit: SECRET_KEY, DATABASE_URL, TEST_DATABASE_URL, ...
uv sync                          # creates .venv from pyproject.toml / uv.lock
uv run flask --app wsgi db upgrade   # apply migrations
uv run flask --app wsgi seed         # initial admin + initial site content (safe to re-run)
uv run flask --app wsgi run --debug  # API on http://127.0.0.1:5000

# 3. Frontend (in another terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173 (proxies /api and /media to Flask)
```

To add clearly labelled **sample** content for development or demos, run `uv run flask --app wsgi seed-demo`. This command refuses to run when `APP_ENV=production`.

## Administrator provisioning

`flask seed` creates the bootstrap administrator **only if no administrator exists**. Running it again never creates a duplicate.

| Username | Initial password |
|----------|------------------|
| `vglug`  | `vglug@123`      |

- The password is stored as an **Argon2** hash and never as plain text.
- At first sign-in, the admin is **required to change the password**. Every admin API returns `403 password_change_required` until they do.
- Changing the password signs out all other sessions for that account.
- You can override the bootstrap values with `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` in `.env`.
- **Replace the initial password before any public deployment.**

Sign in at `http://localhost:5173/admin/login`.

## Initial content and review

`flask seed` writes the Home, About Us, Join Us and Contact Us pages. Their text comes only from VGLUG's official information: history, vision, mission, objectives, initiatives, philosophy and the three recognitions. The content is stored in PostgreSQL and can be edited under **Admin → Pages**.

The pages are created as **drafts**. An administrator reviews and publishes them, and the dashboard lists each page's status. Use `flask seed --publish-pages` to publish them immediately.

Seeding never overwrites rows that already exist, so administrator edits are preserved. To replace pages, navigation, footer and social links with the latest built-in content (for example after upgrading), run `flask --app wsgi seed --overwrite-site-content`. It asks for confirmation and does not touch blogs, events, meetups, comments, subscribers, media or admins.

The seed content also uses facts published on [vglug.org](https://vglug.org/): VGLUG's FOSS contributions, the campus GLUGs, the Telegram group and mailing list (the Join Us button), the coordinator phone number and the official social media links. The email address, postal address, registration ID and donation QR code are not published there and are intentionally left empty. Fill them in with the organisation's real values under **Admin → Footer**.

## Migrations

```bash
cd backend
uv run flask --app wsgi db upgrade              # apply all migrations
uv run flask --app wsgi db downgrade -1         # roll back the latest migration
uv run flask --app wsgi db migrate -m "describe change"   # after editing app/models.py; review the generated file
uv run flask --app wsgi db current              # show the applied revision
```

Back up the database before upgrading or downgrading in production (see below). Never edit the schema by hand.

## Configuration

All settings are environment variables; see [backend/.env.example](backend/.env.example). The important ones are:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Signs sessions, CSRF tokens, visitor hashes and email links. Use a long random value. |
| `DATABASE_URL` / `TEST_DATABASE_URL` | PostgreSQL URLs (`postgresql+psycopg://…`). The test database is wiped during test runs. |
| `PUBLIC_BASE_URL` | Public origin, used to build links in emails. |
| `SESSION_COOKIE_SECURE` | Set to `true` behind HTTPS. |
| `TRUST_PROXY_COUNT` | Number of reverse proxies in front of the app. Needed for correct rate-limit IPs. |
| `UPLOAD_FOLDER`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB` | Local media storage location and size limits. |
| `RATELIMIT_STORAGE_URI` | `memory://` by default. Use Redis when running several workers. |
| `COMMENTS_REQUIRE_APPROVAL` | `true` (default) holds comments for moderation. |
| `EMAIL_BACKEND`, `EMAIL_FROM`, `SMTP_*` | Email delivery (see below). |
| `FRONTEND_DIST` | Optional path to `frontend/dist` so Flask serves the built SPA. |

## Local media storage

Uploads are written to `UPLOAD_FOLDER` (default `backend/uploads/`), in the folders `blogs/`, `events/`, `meetups/`, `join-us/`, `pages/` and `footer/`.

How uploads are handled:

- **Validation.** The server checks the file's signature (magic bytes), not the name or MIME type the browser sends. JPEG, PNG, GIF, WebP, MP4 and WebM are allowed; SVG and executables are rejected. Images are also decoded with Pillow, and size limits are enforced.
- **Storage.** Each file gets a random UUID name and is written atomically. A WebP thumbnail is generated for large images.
- **Metadata.** The `media` table stores the relative path, the original (sanitised) filename, MIME type, size, dimensions, alt text and caption. Absolute filesystem paths are never exposed.
- **Access control.** Files are served at `/media/<relative path>`, with HTTP range support for video. Anonymous visitors can only load a file that is used by published content, a published page or the footer. Draft-only files are visible to admins only.
- **Cleanup.** Deleting content, or replacing a cover or QR code, removes files that are no longer used anywhere. **Admin → Media library** shows storage usage and has an "unused files" cleanup. You can also run `flask --app wsgi media-cleanup --dry-run`.

Mount `UPLOAD_FOLDER` on persistent storage that survives redeploys, and don't put it in a web-executable location.

### Backup and recovery

Back up the database and the upload folder **together**, because the `media` rows and the files must stay in sync:

```bash
pg_dump -Fc "$DATABASE_URL_PLAIN" > vglug-$(date +%F).dump        # plain postgresql:// URL
tar czf vglug-uploads-$(date +%F).tgz -C backend uploads
# restore
pg_restore --clean --if-exists -d "$DATABASE_URL_PLAIN" vglug-YYYY-MM-DD.dump
tar xzf vglug-uploads-YYYY-MM-DD.tgz -C backend
```

## Email subscriptions

Visitors subscribe from the footer. Subscription is **double opt-in**: the visitor must confirm by email before they receive anything. Every announcement email includes an unsubscribe link and a `List-Unsubscribe` header.

When an admin first publishes a blog, event or meetup, the app adds one announcement per eligible subscriber to the `email_outbox` table, inside the same transaction as the publish. A partial unique index guarantees that nobody gets two emails for the same item. Re-publishing never re-sends, and drafts are never announced.

Delivery happens in a separate worker, so publishing never waits on SMTP:

```bash
uv run flask --app wsgi email-worker              # long-running worker (retries with backoff)
uv run flask --app wsgi email-worker --once       # process once (e.g. from cron)
```

Admins can also trigger delivery from **Admin → Subscribers**.

- **Development:** `EMAIL_BACKEND=console` prints emails to the log.
- **Production:** set `EMAIL_BACKEND=smtp` along with `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` and `SMTP_SECURITY` (`starttls`, `ssl` or `none`).
- **Disabled:** if email is disabled or not configured, the subscribe form is hidden and publishing works normally.

## Tests

```bash
cd backend && uv run pytest           # needs TEST_DATABASE_URL (a disposable database)
cd frontend && npm test               # vitest + Testing Library
```

**Backend tests** run against a real PostgreSQL database with the Alembic migrations applied. They cover:

- admin login and logout, Argon2 hashing, idempotent admin seeding and the forced password change
- session invalidation and CSRF
- admin-only access and protection of drafts
- Markdown/XSS sanitisation
- like uniqueness and anonymous comments with spam checks and moderation
- subscription, confirmation and unsubscribe, duplicate-free announcements and retries on delivery failure
- navigation, footer and Join Us management
- media upload success and failure, metadata, access control and cleanup
- migration downgrade and upgrade

**Frontend tests** cover theme persistence, the order of the navigation items, the Explore dropdown (keyboard and click), the mobile menu, and safe rendering of comments.

## Deployment notes

1. Build the frontend with `cd frontend && npm run build`.
2. Set `FRONTEND_DIST=/abs/path/frontend/dist` so Flask serves the SPA. Flask then adds a strict Content-Security-Policy and falls back to `index.html` for client routes. You can instead serve `dist/` from your web server and proxy `/api` and `/media` to Flask.
3. Run the API with `uv run gunicorn -w 3 -b 127.0.0.1:8000 wsgi:app` behind HTTPS (e.g. nginx).
4. Set `SESSION_COOKIE_SECURE=true`, `TRUST_PROXY_COUNT=1` and `APP_ENV=production`.
5. Use Redis for `RATELIMIT_STORAGE_URI` when running more than one worker.
6. Run `flask db upgrade` on each deploy, and keep `flask email-worker` running as a service (systemd/supervisor).
7. Change the bootstrap admin password, and fill in the real contact details, QR code and social links.

## Security summary

- **Admin authentication.** Admin-only authentication uses server-side checks on every protected endpoint. Passwords are hashed with Argon2, and the password must be changed on first login.
- **Cookies and CSRF.** The session cookie is HttpOnly and SameSite=Lax, and sessions are versioned so a password change invalidates them. Each session has a CSRF token, and every unsafe API call must send an `X-Requested-With` header. Sensitive endpoints are rate-limited.
- **Markdown.** Raw HTML is disabled and the rendered output is cleaned with an nh3 allow-list (no scripts, event handlers or `javascript:`/`data:` URLs). Visitor comments are stored and shown as plain text.
- **Likes.** Duplicate likes are prevented by a unique constraint on an HMAC of a random HttpOnly visitor cookie. No IP addresses or personal data are stored.
- **Links.** Navigation, footer and page links are validated, and system routes cannot be removed or re-pointed.
