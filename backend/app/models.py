"""PostgreSQL schema. There are intentionally no public user/account tables."""

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow, onupdate=utcnow
    )


CONTENT_TYPES = ("blog", "event", "meetup")
CONTENT_STATUSES = ("draft", "published", "archived")
EVENT_STATUSES = ("scheduled", "postponed", "cancelled", "completed")
COMMENT_STATUSES = ("pending", "approved", "rejected")
PAGE_KEYS = ("home", "about", "join", "contact")


class Admin(TimestampMixin, db.Model):
    __tablename__ = "admins"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, unique=True)
    display_name = db.Column(db.String(120), nullable=False, default="")
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="admin")
    must_change_password = db.Column(db.Boolean, nullable=False, default=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    # Bumped on password change so older sessions stop working.
    session_version = db.Column(db.Integer, nullable=False, default=1)
    last_login_at = db.Column(db.DateTime(timezone=True))

    __table_args__ = (CheckConstraint("role IN ('admin')", name="role_valid"),)

    @property
    def public_name(self) -> str:
        return self.display_name or self.username


class Media(TimestampMixin, db.Model):
    __tablename__ = "media"

    id = db.Column(db.Integer, primary_key=True)
    storage_provider = db.Column(db.String(20), nullable=False, default="local")
    category = db.Column(db.String(20), nullable=False)  # blogs, events, meetups, join-us, footer, pages
    relative_path = db.Column(db.String(255), nullable=False, unique=True)
    thumb_relative_path = db.Column(db.String(255))
    stored_filename = db.Column(db.String(128), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(64), nullable=False)
    kind = db.Column(db.String(10), nullable=False)  # image | video
    size_bytes = db.Column(db.BigInteger, nullable=False)
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    alt_text = db.Column(db.String(300), nullable=False, default="")
    caption = db.Column(db.String(500), nullable=False, default="")
    status = db.Column(db.String(10), nullable=False, default="ready")
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("storage_provider = 'local'", name="provider_local"),
        CheckConstraint("kind IN ('image', 'video')", name="kind_valid"),
        CheckConstraint("size_bytes >= 0", name="size_positive"),
    )


class ContentItem(TimestampMixin, db.Model):
    """Blogs, events and meetups share one table; event-only fields live in EventDetails."""

    __tablename__ = "content_items"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(10), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.String(500), nullable=False, default="")
    body_md = db.Column(db.Text, nullable=False, default="")
    status = db.Column(db.String(12), nullable=False, default="draft")
    cover_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"))
    author_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="SET NULL"))
    updated_by_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="SET NULL"))
    published_at = db.Column(db.DateTime(timezone=True))
    # Set once when announcement emails are queued, so re-publishing never re-sends.
    announced_at = db.Column(db.DateTime(timezone=True))

    cover = db.relationship("Media", foreign_keys=[cover_media_id])
    author = db.relationship("Admin", foreign_keys=[author_id])
    event = db.relationship("EventDetails", uselist=False, back_populates="content", cascade="all, delete-orphan")
    media_links = db.relationship(
        "ContentMedia", back_populates="content", cascade="all, delete-orphan", order_by="ContentMedia.position"
    )

    __table_args__ = (
        UniqueConstraint("type", "slug", name="uq_content_items_type_slug"),
        CheckConstraint("type IN ('blog', 'event', 'meetup')", name="type_valid"),
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="status_valid"),
        Index("ix_content_items_public_listing", "type", "status", "published_at"),
    )

    @property
    def is_public(self) -> bool:
        return self.status == "published"


class EventDetails(db.Model):
    __tablename__ = "event_details"

    content_id = db.Column(db.Integer, db.ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True)
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False)
    ends_at = db.Column(db.DateTime(timezone=True))
    timezone = db.Column(db.String(64), nullable=False, default="Asia/Kolkata")
    location_name = db.Column(db.String(200), nullable=False, default="")
    address = db.Column(db.String(500), nullable=False, default="")
    is_online = db.Column(db.Boolean, nullable=False, default=False)
    online_url = db.Column(db.String(500), nullable=False, default="")
    registration_url = db.Column(db.String(500), nullable=False, default="")
    registration_info = db.Column(db.String(1000), nullable=False, default="")
    event_status = db.Column(db.String(12), nullable=False, default="scheduled")

    content = db.relationship("ContentItem", back_populates="event")

    __table_args__ = (
        CheckConstraint("event_status IN ('scheduled', 'postponed', 'cancelled', 'completed')", name="status_valid"),
        CheckConstraint("ends_at IS NULL OR ends_at >= starts_at", name="ends_after_start"),
        Index("ix_event_details_starts_at", "starts_at"),
    )


class ContentMedia(db.Model):
    """Media attached to a content item: gallery items and files referenced from the Markdown body."""

    __tablename__ = "content_media"

    content_id = db.Column(db.Integer, db.ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True)
    media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="CASCADE"), primary_key=True)
    in_gallery = db.Column(db.Boolean, nullable=False, default=False)
    position = db.Column(db.Integer, nullable=False, default=0)

    content = db.relationship("ContentItem", back_populates="media_links")
    media = db.relationship("Media")


class Like(db.Model):
    __tablename__ = "likes"

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, db.ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False)
    # HMAC of a random visitor cookie; no IP address or personal data is stored.
    visitor_hash = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow)

    __table_args__ = (UniqueConstraint("content_id", "visitor_hash", name="uq_likes_content_visitor"),)


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, db.ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False)
    author_name = db.Column(db.String(80), nullable=False, default="")
    body = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(10), nullable=False, default="pending")
    visitor_hash = db.Column(db.String(64), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow)
    moderated_at = db.Column(db.DateTime(timezone=True))
    moderated_by_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="SET NULL"))

    content = db.relationship("ContentItem")

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="status_valid"),
        Index("ix_comments_content_status", "content_id", "status", "created_at"),
    )


class SitePage(TimestampMixin, db.Model):
    """Editable informational pages: home, about, join, contact."""

    __tablename__ = "site_pages"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(20), nullable=False, unique=True)
    title = db.Column(db.String(200), nullable=False)
    eyebrow = db.Column(db.String(120), nullable=False, default="")
    intro_md = db.Column(db.Text, nullable=False, default="")
    cta_label = db.Column(db.String(80), nullable=False, default="")
    cta_url = db.Column(db.String(500), nullable=False, default="")
    status = db.Column(db.String(12), nullable=False, default="draft")
    published_at = db.Column(db.DateTime(timezone=True))
    updated_by_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="SET NULL"))

    sections = db.relationship(
        "PageSection", back_populates="page", cascade="all, delete-orphan", order_by="PageSection.position"
    )

    __table_args__ = (
        CheckConstraint("key IN ('home', 'about', 'join', 'contact')", name="key_valid"),
        CheckConstraint("status IN ('draft', 'published')", name="status_valid"),
    )


SECTION_LAYOUTS = ("prose", "cards", "list", "awards", "stats", "callout", "features", "links")


class PageSection(db.Model):
    __tablename__ = "page_sections"

    id = db.Column(db.Integer, primary_key=True)
    page_id = db.Column(db.Integer, db.ForeignKey("site_pages.id", ondelete="CASCADE"), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    anchor = db.Column(db.String(60), nullable=False, default="")
    layout = db.Column(db.String(10), nullable=False, default="prose")
    heading = db.Column(db.String(200), nullable=False, default="")
    body_md = db.Column(db.Text, nullable=False, default="")
    # Structured items for card/list/award/stat/feature/link layouts: [{"title", "subtitle", "body_md", "url"}]
    items = db.Column(JSONB, nullable=False, default=list)
    is_visible = db.Column(db.Boolean, nullable=False, default=True)

    page = db.relationship("SitePage", back_populates="sections")

    __table_args__ = (
        CheckConstraint(
            "layout IN ('prose', 'cards', 'list', 'awards', 'stats', 'callout', 'features', 'links')", name="layout_valid"
        ),
    )


class PageMedia(db.Model):
    __tablename__ = "page_media"

    page_id = db.Column(db.Integer, db.ForeignKey("site_pages.id", ondelete="CASCADE"), primary_key=True)
    media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="CASCADE"), primary_key=True)


class NavItem(db.Model):
    """Main navigation and footer link menus."""

    __tablename__ = "nav_items"

    id = db.Column(db.Integer, primary_key=True)
    menu = db.Column(db.String(10), nullable=False, default="main")  # main | footer
    parent_id = db.Column(db.Integer, db.ForeignKey("nav_items.id", ondelete="CASCADE"))
    label = db.Column(db.String(60), nullable=False)
    url = db.Column(db.String(500), nullable=False, default="")
    position = db.Column(db.Integer, nullable=False, default=0)
    is_visible = db.Column(db.Boolean, nullable=False, default=True)
    # Non-null for routes the application depends on; these cannot be deleted or re-pointed.
    system_key = db.Column(db.String(20))
    open_in_new_tab = db.Column(db.Boolean, nullable=False, default=False)

    children = db.relationship("NavItem", order_by="NavItem.position", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("menu IN ('main', 'footer')", name="menu_valid"),
        UniqueConstraint("menu", "system_key", name="uq_nav_items_menu_system_key"),
    )


class FooterSettings(db.Model):
    """Singleton row (id = 1)."""

    __tablename__ = "footer_settings"

    id = db.Column(db.Integer, primary_key=True)
    org_name = db.Column(db.String(200), nullable=False, default="")
    short_name = db.Column(db.String(40), nullable=False, default="")
    description = db.Column(db.Text, nullable=False, default="")
    email = db.Column(db.String(200), nullable=False, default="")
    phone = db.Column(db.String(60), nullable=False, default="")
    address = db.Column(db.String(500), nullable=False, default="")
    registration_id = db.Column(db.String(120), nullable=False, default="")
    donation_text = db.Column(db.String(500), nullable=False, default="")
    donation_qr_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"))
    donation_qr_alt = db.Column(db.String(300), nullable=False, default="")
    copyright_text = db.Column(db.String(300), nullable=False, default="")
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow, onupdate=utcnow)

    donation_qr = db.relationship("Media")

    __table_args__ = (CheckConstraint("id = 1", name="singleton"),)


SOCIAL_PLATFORMS = (
    "facebook", "x", "instagram", "linkedin", "youtube", "github", "gitlab",
    "mastodon", "telegram", "whatsapp", "matrix", "website",
)


class SocialLink(db.Model):
    __tablename__ = "social_links"

    id = db.Column(db.Integer, primary_key=True)
    platform = db.Column(db.String(20), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    label = db.Column(db.String(80), nullable=False, default="")
    position = db.Column(db.Integer, nullable=False, default=0)


class Subscriber(db.Model):
    __tablename__ = "subscribers"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), nullable=False, unique=True)
    status = db.Column(db.String(14), nullable=False, default="pending")
    wants_blogs = db.Column(db.Boolean, nullable=False, default=True)
    wants_events = db.Column(db.Boolean, nullable=False, default=True)
    wants_meetups = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow)
    confirmed_at = db.Column(db.DateTime(timezone=True))
    unsubscribed_at = db.Column(db.DateTime(timezone=True))
    last_verification_sent_at = db.Column(db.DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'active', 'unsubscribed')", name="status_valid"),
    )

    def wants(self, content_type: str) -> bool:
        return {"blog": self.wants_blogs, "event": self.wants_events, "meetup": self.wants_meetups}[content_type]


class EmailOutbox(db.Model):
    __tablename__ = "email_outbox"

    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(14), nullable=False)  # verification | announcement
    subscriber_id = db.Column(db.Integer, db.ForeignKey("subscribers.id", ondelete="CASCADE"), nullable=False)
    content_id = db.Column(db.Integer, db.ForeignKey("content_items.id", ondelete="CASCADE"))
    status = db.Column(db.String(10), nullable=False, default="pending")
    attempts = db.Column(db.Integer, nullable=False, default=0)
    last_error = db.Column(db.String(500), nullable=False, default="")
    next_attempt_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), default=utcnow)
    sent_at = db.Column(db.DateTime(timezone=True))

    subscriber = db.relationship("Subscriber")
    content = db.relationship("ContentItem")

    __table_args__ = (
        CheckConstraint("kind IN ('verification', 'announcement')", name="kind_valid"),
        CheckConstraint("status IN ('pending', 'sent', 'failed')", name="status_valid"),
        # One announcement per subscriber per content item, enforced by the database.
        Index(
            "uq_email_outbox_announcement",
            "subscriber_id",
            "content_id",
            unique=True,
            postgresql_where=db.text("kind = 'announcement'"),
        ),
        Index("ix_email_outbox_due", "status", "next_attempt_at"),
    )
