"""Queue subscription emails. Rows are only inserted here; delivery happens in the worker."""

from sqlalchemy import literal, select
from sqlalchemy.dialects.postgresql import insert

from ..extensions import db
from ..models import ContentItem, EmailOutbox, Subscriber, utcnow
from .email import subscriptions_available

PREFERENCE_COLUMN = {
    "blog": Subscriber.wants_blogs,
    "event": Subscriber.wants_events,
    "meetup": Subscriber.wants_meetups,
}


def queue_verification(subscriber: Subscriber):
    db.session.add(EmailOutbox(kind="verification", subscriber_id=subscriber.id))
    subscriber.last_verification_sent_at = utcnow()


def queue_announcement(item: ContentItem) -> int:
    """Queue one announcement per eligible subscriber, exactly once per content item.

    Must be called inside the publishing transaction. Returns the number of rows queued.
    """
    if item.status != "published" or item.announced_at is not None:
        return 0
    # Mark first, so a later unpublish/re-publish never announces again.
    item.announced_at = utcnow()
    if not subscriptions_available():
        return 0
    eligible = select(
        literal("announcement"), Subscriber.id, literal(item.id), literal("pending")
    ).where(Subscriber.status == "active", PREFERENCE_COLUMN[item.type].is_(True))
    stmt = (
        insert(EmailOutbox)
        .from_select(["kind", "subscriber_id", "content_id", "status"], eligible)
        .on_conflict_do_nothing(
            index_elements=["subscriber_id", "content_id"], index_where=EmailOutbox.kind == "announcement"
        )
    )
    result = db.session.execute(stmt)
    return result.rowcount or 0
