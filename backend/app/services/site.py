from sqlalchemy import select

from ..extensions import db
from ..models import FooterSettings, NavItem, SitePage, SocialLink
from .content import iso
from .markdown import render_markdown
from .media_refs import serialize_media

# Routes the frontend depends on. Their destinations are fixed and they cannot be deleted.
SYSTEM_NAV = {
    "home": "/",
    "explore": "",
    "meetups": "/meetups",
    "events": "/events",
    "blogs": "/blogs",
    "about": "/about",
    "join": "/join",
    "contact": "/contact",
}
# System items that must always remain visible in the main menu.
ALWAYS_VISIBLE = {"home", "join"}


def serialize_section(section, admin: bool = False) -> dict:
    data = {
        "id": section.id,
        "anchor": section.anchor,
        "layout": section.layout,
        "heading": section.heading,
        "is_visible": section.is_visible,
        "items": [
            {
                "title": i.get("title", ""),
                "subtitle": i.get("subtitle", ""),
                "url": i.get("url", ""),
                **({"body_md": i.get("body_md", "")} if admin else {}),
                "body_html": render_markdown(i.get("body_md", "")),
            }
            for i in (section.items or [])
        ],
        "body_html": render_markdown(section.body_md),
    }
    if admin:
        data["body_md"] = section.body_md
    return data


def serialize_page(page: SitePage, admin: bool = False) -> dict:
    sections = [s for s in page.sections if admin or s.is_visible]
    data = {
        "key": page.key,
        "title": page.title,
        "eyebrow": page.eyebrow,
        "intro_html": render_markdown(page.intro_md),
        "cta_label": page.cta_label,
        "cta_url": page.cta_url,
        "status": page.status,
        "published_at": iso(page.published_at),
        "updated_at": iso(page.updated_at),
        "sections": [serialize_section(s, admin) for s in sections],
    }
    if admin:
        data["intro_md"] = page.intro_md
    return data


def serialize_nav_item(item: NavItem, admin: bool = False) -> dict:
    data = {
        "id": item.id,
        "label": item.label,
        "url": SYSTEM_NAV.get(item.system_key, item.url) if item.system_key else item.url,
        "system_key": item.system_key,
        "open_in_new_tab": item.open_in_new_tab,
        "children": [serialize_nav_item(c, admin) for c in item.children if admin or c.is_visible],
    }
    if admin:
        data["is_visible"] = item.is_visible
    return data


def nav_tree(menu: str, admin: bool = False) -> list[dict]:
    roots = db.session.scalars(
        select(NavItem).where(NavItem.menu == menu, NavItem.parent_id.is_(None)).order_by(NavItem.position)
    ).all()
    return [serialize_nav_item(r, admin) for r in roots if admin or r.is_visible]


def get_footer() -> FooterSettings:
    footer = db.session.get(FooterSettings, 1)
    if footer is None:
        footer = FooterSettings(id=1)
        db.session.add(footer)
        db.session.flush()
    return footer


def serialize_footer(footer: FooterSettings) -> dict:
    socials = db.session.scalars(select(SocialLink).order_by(SocialLink.position)).all()
    qr = serialize_media(footer.donation_qr)
    return {
        "org_name": footer.org_name,
        "short_name": footer.short_name,
        "description": footer.description,
        "email": footer.email,
        "phone": footer.phone,
        "address": footer.address,
        "registration_id": footer.registration_id,
        "donation_text": footer.donation_text,
        "donation_qr": qr,
        "donation_qr_alt": footer.donation_qr_alt,
        "copyright_text": footer.copyright_text,
        "social_links": [{"id": s.id, "platform": s.platform, "url": s.url, "label": s.label} for s in socials],
    }
