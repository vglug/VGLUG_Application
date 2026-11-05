"""Email delivery: configurable backend + database outbox processed by a worker.

Publishing only inserts outbox rows (fast, transactional). `flask email-worker`
delivers them in the background with retries, so publishing never waits on SMTP.
"""

import logging
import smtplib
import ssl
from datetime import timedelta
from email.message import EmailMessage
from html import escape
from zoneinfo import ZoneInfo

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeSerializer, URLSafeTimedSerializer
from sqlalchemy import select

from ..extensions import db
from ..models import EmailOutbox, utcnow
from .markdown import plain_excerpt

log = logging.getLogger(__name__)

# Messages captured by the in-memory backend (automated tests only).
memory_outbox: list[EmailMessage] = []

TYPE_LABELS = {"blog": "blog post", "event": "event", "meetup": "meetup"}
TYPE_PATHS = {"blog": "blogs", "event": "events", "meetup": "meetups"}


class EmailNotConfigured(Exception):
    pass


# --- Tokens -------------------------------------------------------------------


def _verify_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="subscription-verify")


def _unsubscribe_serializer():
    return URLSafeSerializer(current_app.config["SECRET_KEY"], salt="subscription-unsubscribe")


def make_verify_token(subscriber_id: int, email: str) -> str:
    return _verify_serializer().dumps({"id": subscriber_id, "e": email})


def read_verify_token(token: str) -> dict | None:
    try:
        return _verify_serializer().loads(token, max_age=current_app.config["SUBSCRIPTION_TOKEN_MAX_AGE"])
    except (BadSignature, SignatureExpired):
        return None


def make_unsubscribe_token(subscriber_id: int, email: str) -> str:
    return _unsubscribe_serializer().dumps({"id": subscriber_id, "e": email})


def read_unsubscribe_token(token: str) -> dict | None:
    try:
        return _unsubscribe_serializer().loads(token)
    except BadSignature:
        return None


# --- Delivery -----------------------------------------------------------------


def email_ready() -> bool:
    cfg = current_app.config
    backend = cfg["EMAIL_BACKEND"]
    if backend == "smtp":
        return bool(cfg["SMTP_HOST"] and cfg["EMAIL_FROM"])
    return backend in {"console", "memory"}


def subscriptions_available() -> bool:
    return current_app.config["SUBSCRIPTIONS_ENABLED"] and email_ready()


def deliver(message: EmailMessage):
    cfg = current_app.config
    backend = cfg["EMAIL_BACKEND"]
    if backend == "memory":
        memory_outbox.append(message)
    elif backend == "console":
        text = message.get_body(("plain",))
        log.info("[console email] To: %s | Subject: %s\n%s", message["To"], message["Subject"],
                 text.get_content() if text else "")
    elif backend == "smtp":
        if not email_ready():
            raise EmailNotConfigured("SMTP_HOST and EMAIL_FROM must be configured.")
        security = cfg["SMTP_SECURITY"]
        context = ssl.create_default_context()
        smtp_cls = smtplib.SMTP_SSL if security == "ssl" else smtplib.SMTP
        kwargs = {"timeout": cfg["SMTP_TIMEOUT"]}
        if security == "ssl":
            kwargs["context"] = context
        with smtp_cls(cfg["SMTP_HOST"], cfg["SMTP_PORT"], **kwargs) as smtp:
            if security == "starttls":
                smtp.starttls(context=context)
            if cfg["SMTP_USERNAME"]:
                smtp.login(cfg["SMTP_USERNAME"], cfg["SMTP_PASSWORD"])
            smtp.send_message(message)
    else:
        raise EmailNotConfigured("Email delivery is disabled.")


def _wrap_html(title: str, inner: str, footer: str) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f1ea;color:#46050d;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ea;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-top:6px solid #46050d;">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a3b3f;">VGLUG Foundation</td></tr>
<tr><td style="padding:0 28px 28px;font-size:16px;line-height:1.6;color:#2b0a0e;">{inner}</td></tr>
<tr><td style="padding:16px 28px;background:#f3f1ea;font-size:13px;line-height:1.5;color:#5a2a2e;">{footer}</td></tr>
</table></td></tr></table></body></html>"""


def _button(url: str, label: str) -> str:
    return (
        f'<p style="margin:24px 0;"><a href="{escape(url)}" style="background:#46050d;color:#ffffff;'
        f'padding:12px 20px;text-decoration:none;font-weight:bold;display:inline-block;">{escape(label)}</a></p>'
    )


def build_verification(entry: EmailOutbox) -> EmailMessage:
    base = current_app.config["PUBLIC_BASE_URL"]
    sub = entry.subscriber
    link = f"{base}/subscribe/confirm?token={make_verify_token(sub.id, sub.email)}"
    subject = "Confirm your VGLUG updates subscription"
    text = (
        "Hello,\n\nPlease confirm that you want to receive announcements from VGLUG "
        f"(Viluppuram GNU/Linux Users Group) by opening this link:\n\n{link}\n\n"
        "If you did not request this, ignore this email and you will not be subscribed.\n"
    )
    inner = (
        f'<h1 style="font-size:22px;margin:0 0 12px;color:#46050d;">Confirm your subscription</h1>'
        "<p>Please confirm that you want to receive announcements about new blogs, events and meetups from VGLUG.</p>"
        f"{_button(link, 'Confirm subscription')}"
        f'<p style="font-size:14px;">Or copy this link into your browser:<br>{escape(link)}</p>'
    )
    footer = "If you did not request this, ignore this email — you will not be subscribed."
    return _message(sub.email, subject, text, _wrap_html(subject, inner, footer))


def build_announcement(entry: EmailOutbox) -> EmailMessage:
    base = current_app.config["PUBLIC_BASE_URL"]
    item, sub = entry.content, entry.subscriber
    url = f"{base}/{TYPE_PATHS[item.type]}/{item.id}-{item.slug}"
    unsubscribe = f"{base}/unsubscribe?token={make_unsubscribe_token(sub.id, sub.email)}"
    label = TYPE_LABELS[item.type]
    summary = item.summary or plain_excerpt(item.body_md, 240)
    subject = f"New {label} from VGLUG: {item.title}"
    when = ""
    if item.event is not None:
        tz = ZoneInfo(item.event.timezone)
        when = f"\nWhen: {item.event.starts_at.astimezone(tz).strftime('%d %b %Y, %H:%M')} ({item.event.timezone})"
    text = (
        f"A new {label} has been published on the VGLUG website.\n\n{item.title}\n{summary}{when}\n\n"
        f"Read more: {url}\n\n---\nYou are receiving this because you subscribed to VGLUG updates.\n"
        f"Unsubscribe: {unsubscribe}\n"
    )
    inner = (
        f'<p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#c3543e;">New {escape(label)}</p>'
        f'<h1 style="font-size:24px;margin:0 0 12px;color:#46050d;">{escape(item.title)}</h1>'
        f"<p>{escape(summary)}</p>"
        + (f"<p><strong>When:</strong> {escape(when.strip().removeprefix('When: '))}</p>" if when else "")
        + _button(url, f"Read the {label}")
    )
    footer = (
        "You are receiving this because you subscribed to VGLUG updates. "
        f'<a href="{escape(unsubscribe)}" style="color:#46050d;">Unsubscribe</a> at any time.'
    )
    msg = _message(sub.email, subject, text, _wrap_html(subject, inner, footer))
    msg["List-Unsubscribe"] = f"<{unsubscribe}>"
    return msg


def _message(to: str, subject: str, text: str, html: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = current_app.config["EMAIL_FROM"] or "VGLUG <no-reply@localhost>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def process_outbox(batch_size: int = 50) -> dict:
    """Send due emails. Safe to run from several workers (rows are locked with SKIP LOCKED)."""
    if not email_ready():
        return {"sent": 0, "failed": 0, "skipped": "email backend not configured"}
    max_attempts = current_app.config["EMAIL_MAX_ATTEMPTS"]
    entries = db.session.scalars(
        select(EmailOutbox)
        .where(EmailOutbox.status == "pending", EmailOutbox.next_attempt_at <= utcnow())
        .order_by(EmailOutbox.id)
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    ).all()
    sent = failed = 0
    for entry in entries:
        sub = entry.subscriber
        is_announcement = entry.kind == "announcement"
        # Skip silently if the recipient opted out or the content was unpublished meanwhile.
        if (is_announcement and (sub.status != "active" or entry.content is None or entry.content.status != "published")) or (
            not is_announcement and sub.status != "pending"
        ):
            entry.status, entry.last_error = "failed", "skipped: no longer eligible"
            continue
        try:
            message = build_announcement(entry) if is_announcement else build_verification(entry)
            deliver(message)
            entry.status, entry.sent_at, entry.last_error = "sent", utcnow(), ""
            sent += 1
        except Exception as e:  # noqa: BLE001 - any delivery error is recorded and retried
            entry.attempts += 1
            entry.last_error = f"{type(e).__name__}: {str(e)[:200]}"
            if entry.attempts >= max_attempts:
                entry.status = "failed"
            else:
                entry.next_attempt_at = utcnow() + timedelta(minutes=2 ** entry.attempts)
            failed += 1
            log.warning("Email delivery failed (outbox id %s): %s", entry.id, type(e).__name__)
    db.session.commit()
    return {"sent": sent, "failed": failed}
