import logging
import time
from datetime import timedelta

import click
from flask import current_app
from sqlalchemy import func, select

from .extensions import db
from .models import Admin, ContentItem, EventDetails, FooterSettings, NavItem, PageSection, SitePage, SocialLink, utcnow
from .seed_data import FOOTER, FOOTER_NAV, MAIN_NAV, PAGES, SOCIAL_LINKS
from .security import hash_password

log = logging.getLogger(__name__)


def ensure_initial_admin() -> bool:
    """Create the bootstrap administrator only if no administrator exists. Returns True if created."""
    if db.session.scalar(select(func.count()).select_from(Admin)) > 0:
        return False
    cfg = current_app.config
    db.session.add(
        Admin(
            username=cfg["INITIAL_ADMIN_USERNAME"].strip().lower(),
            display_name="VGLUG Admin",
            password_hash=hash_password(cfg["INITIAL_ADMIN_PASSWORD"]),
            must_change_password=True,
        )
    )
    db.session.commit()
    return True


def seed_pages(publish: bool = False) -> list[str]:
    created = []
    for key, spec in PAGES.items():
        if db.session.scalar(select(SitePage.id).where(SitePage.key == key)):
            continue
        page = SitePage(
            key=key,
            title=spec["title"],
            eyebrow=spec["eyebrow"],
            intro_md=spec["intro_md"],
            cta_label=spec["cta_label"],
            cta_url=spec["cta_url"],
            status="published" if publish else "draft",
            published_at=utcnow() if publish else None,
        )
        for position, s in enumerate(spec["sections"]):
            page.sections.append(
                PageSection(
                    position=position,
                    anchor=s.get("anchor", ""),
                    layout=s["layout"],
                    heading=s.get("heading", ""),
                    body_md=s.get("body_md", ""),
                    items=s.get("items", []),
                )
            )
        db.session.add(page)
        created.append(key)
    db.session.commit()
    return created


def seed_navigation() -> bool:
    created = False
    if not db.session.scalar(select(NavItem.id).where(NavItem.menu == "main").limit(1)):
        def add(spec, parent, position):
            from .services.site import SYSTEM_NAV

            node = NavItem(menu="main", label=spec["label"], system_key=spec["system_key"],
                           url=SYSTEM_NAV[spec["system_key"]], position=position)
            db.session.add(node)
            db.session.flush()
            node.parent_id = parent.id if parent else None
            for i, child in enumerate(spec.get("children", [])):
                add(child, node, i)

        for i, spec in enumerate(MAIN_NAV):
            add(spec, None, i)
        created = True
    if not db.session.scalar(select(NavItem.id).where(NavItem.menu == "footer").limit(1)):
        for i, spec in enumerate(FOOTER_NAV):
            db.session.add(NavItem(menu="footer", label=spec["label"], url=spec["url"], position=i))
        created = True
    db.session.commit()
    return created


def seed_footer() -> bool:
    if db.session.get(FooterSettings, 1):
        return False
    db.session.add(FooterSettings(id=1, **FOOTER))
    if not db.session.scalar(select(SocialLink.id).limit(1)):
        for i, link in enumerate(SOCIAL_LINKS):
            db.session.add(SocialLink(position=i, **link))
    db.session.commit()
    return True


def reset_site_content():
    """Delete seeded pages, navigation, footer settings and social links so they can be re-seeded.

    Blogs, events, meetups, comments, subscribers, media files and admins are untouched.
    """
    db.session.execute(SitePage.__table__.delete())
    db.session.execute(NavItem.__table__.delete())
    db.session.execute(SocialLink.__table__.delete())
    db.session.execute(FooterSettings.__table__.delete())
    db.session.commit()


def register_cli(app):
    @app.cli.command("seed")
    @click.option("--publish-pages", is_flag=True, help="Publish seeded pages immediately (skip admin review).")
    @click.option(
        "--overwrite-site-content",
        is_flag=True,
        help="Replace pages, navigation, footer and social links with the built-in content (asks for confirmation).",
    )
    def seed(publish_pages: bool, overwrite_site_content: bool):
        """Create the initial admin and initial site content. Safe to run repeatedly."""
        if overwrite_site_content:
            click.confirm(
                "This discards admin edits to pages, navigation, footer and social links. Continue?", abort=True
            )
            reset_site_content()
            click.echo("Removed existing pages, navigation, footer and social links.")
        if ensure_initial_admin():
            click.echo(f"Created initial administrator '{app.config['INITIAL_ADMIN_USERNAME']}'. "
                       "The password must be changed at first sign-in.")
        else:
            click.echo("Administrator already exists; not modified.")
        pages = seed_pages(publish=publish_pages)
        click.echo(f"Seeded pages: {', '.join(pages)} ({'published' if publish_pages else 'draft — review and publish in the admin panel'})"
                   if pages else "Pages already exist; not modified.")
        click.echo("Seeded navigation." if seed_navigation() else "Navigation already exists; not modified.")
        click.echo("Seeded footer." if seed_footer() else "Footer already exists; not modified.")

    @app.cli.command("seed-demo")
    def seed_demo():
        """Add clearly labelled SAMPLE content for development/demo environments only."""
        if app.config["ENV_NAME"] == "production":
            raise click.ClickException("Refusing to create sample content when APP_ENV=production.")
        admin = db.session.scalar(select(Admin).order_by(Admin.id))
        if admin is None:
            raise click.ClickException("Run `flask seed` first.")
        note = ("\n\n> **Sample content.** This item was generated for development and demonstration. "
                "It does not describe a real VGLUG activity.")
        now = utcnow()
        samples = [
            ("blog", "Sample: Getting started with the GNU/Linux command line",
             "A sample article showing how blog posts look on the VGLUG website.",
             "## Why the command line?\n\nThe shell lets you combine small tools to do big things.\n\n"
             "```bash\nls -la\ngrep -r \"freedom\" ~/notes\n```\n\n- Free to use\n- Free to study\n- Free to share" + note, None),
            ("event", "Sample: Free software awareness workshop",
             "A sample event showing how events look on the website.",
             "## About this sample\n\nEvents display date, time, location and registration details." + note,
             dict(starts_at=now + timedelta(days=14), ends_at=now + timedelta(days=14, hours=3),
                  location_name="Sample venue", is_online=False)),
            ("meetup", "Sample: Weekend community meetup",
             "A sample meetup showing how meetups look on the website.",
             "## About this sample\n\nMeetups are informal sessions for learning together." + note,
             dict(starts_at=now + timedelta(days=5), ends_at=now + timedelta(days=5, hours=2),
                  location_name="Sample location", is_online=False)),
        ]
        from .validation import slugify

        created = 0
        for ctype, title, summary, body, event in samples:
            slug = slugify(title)
            if db.session.scalar(select(ContentItem.id).where(ContentItem.type == ctype, ContentItem.slug == slug)):
                continue
            item = ContentItem(type=ctype, title=title, slug=slug, summary=summary, body_md=body,
                               status="published", published_at=now, announced_at=now, author_id=admin.id)
            if event:
                item.event = EventDetails(timezone="Asia/Kolkata", **event)
            db.session.add(item)
            created += 1
        db.session.commit()
        click.echo(f"Created {created} sample item(s), each clearly labelled as sample content.")

    @app.cli.command("email-worker")
    @click.option("--once", is_flag=True, help="Process due emails once and exit.")
    @click.option("--interval", default=30, show_default=True, help="Seconds between queue checks.")
    def email_worker(once: bool, interval: int):
        """Deliver queued verification and announcement emails."""
        from .services.email import process_outbox

        while True:
            try:
                result = process_outbox()
                if result.get("sent") or result.get("failed"):
                    click.echo(f"sent={result['sent']} failed={result['failed']}")
            except Exception:  # noqa: BLE001 - keep the worker alive across transient DB errors
                db.session.rollback()
                log.exception("Email worker iteration failed")
            if once:
                break
            time.sleep(interval)

    @app.cli.command("media-cleanup")
    @click.option("--dry-run", is_flag=True)
    def media_cleanup(dry_run: bool):
        """Delete media files that are no longer used anywhere (older than one hour)."""
        from .services.media_refs import delete_media, orphan_query

        orphans = db.session.scalars(orphan_query()).all()
        for media in orphans:
            click.echo(f"{'Would remove' if dry_run else 'Removing'} {media.relative_path} ({media.size_bytes} bytes)")
            if not dry_run:
                delete_media(media)
        click.echo(f"{len(orphans)} orphaned file(s).")
