import re
from typing import Literal

from flask import Blueprint
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..errors import not_found, ok
from ..extensions import db
from ..models import PAGE_KEYS, SOCIAL_PLATFORMS, Media, NavItem, PageSection, SitePage, SocialLink, utcnow
from ..security import admin_required, current_admin
from ..services.media_refs import delete_if_unreferenced, sync_page_media
from ..services.site import ALWAYS_VISIBLE, SYSTEM_NAV, get_footer, nav_tree, serialize_footer, serialize_page
from ..validation import check_link, fail, is_valid_email, parse_body

bp = Blueprint("admin_site", __name__, url_prefix="/api/admin")

ANCHOR_RE = re.compile(r"^[a-z0-9-]{0,60}$")
PHONE_RE = re.compile(r"^[0-9+()\-.\s]{0,60}$")
EXPLORE_CHILDREN = {"meetups", "events", "blogs"}


# --- Pages -------------------------------------------------------------------------


class SectionItemIn(BaseModel):
    title: str = Field(default="", max_length=200)
    subtitle: str = Field(default="", max_length=200)
    body_md: str = Field(default="", max_length=5000)
    url: str = Field(default="", max_length=500)


class SectionIn(BaseModel):
    anchor: str = Field(default="", max_length=60)
    layout: Literal["prose", "cards", "list", "awards", "stats", "callout", "features", "links"] = "prose"
    heading: str = Field(default="", max_length=200)
    body_md: str = Field(default="", max_length=50_000)
    items: list[SectionItemIn] = Field(default_factory=list, max_length=40)
    is_visible: bool = True


class PageIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    eyebrow: str = Field(default="", max_length=120)
    intro_md: str = Field(default="", max_length=20_000)
    cta_label: str = Field(default="", max_length=80)
    cta_url: str = Field(default="", max_length=500)
    status: Literal["draft", "published"] = "draft"
    sections: list[SectionIn] = Field(default_factory=list, max_length=30)


def _get_page(key: str) -> SitePage:
    if key not in PAGE_KEYS:
        raise not_found("Unknown page.")
    page = db.session.scalar(select(SitePage).where(SitePage.key == key).options(selectinload(SitePage.sections)))
    if page is None:
        page = SitePage(key=key, title=key.title(), status="draft")
        db.session.add(page)
        db.session.flush()
    return page


@bp.get("/pages")
@admin_required()
def list_pages():
    pages = {p.key: p for p in db.session.scalars(select(SitePage))}
    return ok(
        [
            {
                "key": key,
                "title": pages[key].title if key in pages else key.title(),
                "status": pages[key].status if key in pages else "missing",
                "updated_at": pages[key].updated_at.isoformat() if key in pages else None,
            }
            for key in PAGE_KEYS
        ]
    )


@bp.get("/pages/<key>")
@admin_required()
def get_page(key: str):
    page = _get_page(key)
    db.session.commit()
    return ok(serialize_page(page, admin=True))


@bp.put("/pages/<key>")
@admin_required()
def update_page(key: str):
    page = _get_page(key)
    data = parse_body(PageIn)
    errors = {}
    if data.cta_url.strip() and (msg := check_link(data.cta_url, allow_mailto=True)):
        errors["cta_url"] = msg
    if data.cta_url.strip() and not data.cta_label.strip():
        errors["cta_label"] = "Add a button label for the link."
    for i, s in enumerate(data.sections):
        if not ANCHOR_RE.match(s.anchor):
            errors[f"sections.{i}.anchor"] = "Use lowercase letters, numbers and hyphens."
        for k, item in enumerate(s.items):
            if item.url.strip() and (msg := check_link(item.url, allow_mailto=True)):
                errors[f"sections.{i}.items.{k}.url"] = msg
    if errors:
        fail(errors)

    page.title = data.title.strip()
    page.eyebrow = data.eyebrow.strip()
    page.intro_md = data.intro_md
    page.cta_label = data.cta_label.strip()
    page.cta_url = data.cta_url.strip()
    if data.status == "published" and page.status != "published":
        page.published_at = utcnow()
    page.status = data.status
    page.updated_by_id = current_admin().id
    page.sections.clear()
    db.session.flush()
    for position, s in enumerate(data.sections):
        page.sections.append(
            PageSection(
                position=position,
                anchor=s.anchor,
                layout=s.layout,
                heading=s.heading.strip(),
                body_md=s.body_md,
                items=[{**item.model_dump(), "url": item.url.strip()} for item in s.items],
                is_visible=s.is_visible,
            )
        )
    db.session.flush()
    sync_page_media(page)
    db.session.commit()
    return ok(serialize_page(page, admin=True))


# --- Navigation ------------------------------------------------------------------


class NavItemIn(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    url: str = Field(default="", max_length=500)
    system_key: str | None = None
    is_visible: bool = True
    open_in_new_tab: bool = False
    children: list["NavItemIn"] = Field(default_factory=list, max_length=12)


class NavIn(BaseModel):
    items: list[NavItemIn] = Field(max_length=12)


@bp.get("/navigation")
@admin_required()
def get_navigation():
    return ok({"main": nav_tree("main", admin=True), "footer": nav_tree("footer", admin=True), "system_routes": SYSTEM_NAV})


def _validate_nav(menu: str, items: list[NavItemIn]) -> dict:
    errors = {}
    seen_system: dict[str, str | None] = {}

    def visit(item: NavItemIn, path: str, parent_key: str | None, depth: int):
        label = " ".join(item.label.split())
        if not label or any(ch in label for ch in "<>"):
            errors[f"{path}.label"] = "Enter a plain-text label."
        if item.system_key:
            if menu != "main" or item.system_key not in SYSTEM_NAV:
                errors[f"{path}.system_key"] = "Unknown system route."
                return
            if item.system_key in seen_system:
                errors[f"{path}.system_key"] = "System routes can only appear once."
            seen_system[item.system_key] = parent_key
            if item.system_key in ALWAYS_VISIBLE and not item.is_visible:
                errors[f"{path}.is_visible"] = f"The {label} link must stay visible."
        elif item.children and not item.url.strip():
            pass  # A custom dropdown parent needs no destination.
        elif msg := check_link(item.url, allow_mailto=True):
            errors[f"{path}.url"] = msg
        if item.children:
            if depth >= 1:
                errors[f"{path}.children"] = "Menus can only be one level deep."
                return
            for i, child in enumerate(item.children):
                visit(child, f"{path}.children.{i}", item.system_key or "custom", depth + 1)

    for i, item in enumerate(items):
        visit(item, f"items.{i}", None, 0)

    if menu == "main":
        missing = set(SYSTEM_NAV) - set(seen_system)
        if missing:
            errors["items"] = "Required links cannot be removed: " + ", ".join(sorted(missing)) + "."
        for key, parent in seen_system.items():
            expected_parent = "explore" if key in EXPLORE_CHILDREN else None
            if parent != expected_parent:
                where = "inside Explore" if expected_parent else "at the top level"
                errors.setdefault("items", f"The {key} link must stay {where}.")
    return errors


@bp.put("/navigation/<menu>")
@admin_required()
def update_navigation(menu: str):
    if menu not in ("main", "footer"):
        raise not_found("Unknown menu.")
    data = parse_body(NavIn)
    errors = _validate_nav(menu, data.items)
    if errors:
        fail(errors)

    existing = db.session.scalars(select(NavItem).where(NavItem.menu == menu)).all()
    system_items = {i.system_key: i for i in existing if i.system_key}
    # Detach everything, then rebuild the tree in the submitted order.
    for item in existing:
        item.parent_id = None
    db.session.flush()
    for item in existing:
        if not item.system_key:
            db.session.delete(item)
    db.session.flush()

    def build(item_in: NavItemIn, parent: NavItem | None, position: int):
        if item_in.system_key:
            node = system_items.get(item_in.system_key) or NavItem(menu=menu, system_key=item_in.system_key)
            node.url = SYSTEM_NAV[item_in.system_key]
            node.open_in_new_tab = False
        else:
            node = NavItem(menu=menu, url=item_in.url.strip(), open_in_new_tab=item_in.open_in_new_tab)
        node.label = " ".join(item_in.label.split())
        node.is_visible = item_in.is_visible
        node.position = position
        db.session.add(node)
        db.session.flush()
        node.parent_id = parent.id if parent else None
        for i, child in enumerate(item_in.children):
            build(child, node, i)

    for i, item_in in enumerate(data.items):
        build(item_in, None, i)
    db.session.commit()
    db.session.expire_all()
    return ok({"main": nav_tree("main", admin=True), "footer": nav_tree("footer", admin=True)})


# --- Footer ------------------------------------------------------------------------


class SocialIn(BaseModel):
    platform: Literal[SOCIAL_PLATFORMS]  # type: ignore[valid-type]
    url: str = Field(min_length=1, max_length=500)
    label: str = Field(default="", max_length=80)


class FooterIn(BaseModel):
    org_name: str = Field(default="", max_length=200)
    short_name: str = Field(default="", max_length=40)
    description: str = Field(default="", max_length=2000)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=500)
    registration_id: str = Field(default="", max_length=120)
    donation_text: str = Field(default="", max_length=500)
    donation_qr_media_id: int | None = None
    donation_qr_alt: str = Field(default="", max_length=300)
    copyright_text: str = Field(default="", max_length=300)
    social_links: list[SocialIn] = Field(default_factory=list, max_length=20)


@bp.get("/footer")
@admin_required()
def get_footer_settings():
    footer = get_footer()
    db.session.commit()
    data = serialize_footer(footer)
    data["donation_qr_media_id"] = footer.donation_qr_media_id
    return ok(data)


@bp.put("/footer")
@admin_required()
def update_footer():
    data = parse_body(FooterIn)
    errors = {}
    if data.email.strip() and not is_valid_email(data.email.strip()):
        errors["email"] = "Enter a valid email address."
    if not PHONE_RE.match(data.phone):
        errors["phone"] = "Use digits, spaces and + ( ) - only."
    if data.donation_qr_media_id is not None:
        qr = db.session.get(Media, data.donation_qr_media_id)
        if qr is None or qr.kind != "image":
            errors["donation_qr_media_id"] = "Choose an uploaded image."
        elif not data.donation_qr_alt.strip():
            errors["donation_qr_alt"] = "Describe the QR code for screen-reader users."
    for i, s in enumerate(data.social_links):
        if msg := check_link(s.url, allow_internal=False, allow_mailto=s.platform == "website"):
            errors[f"social_links.{i}.url"] = msg
    if errors:
        fail(errors)

    footer = get_footer()
    previous_qr = footer.donation_qr_media_id
    for field in (
        "org_name", "short_name", "description", "email", "phone", "address", "registration_id",
        "donation_text", "donation_qr_alt", "copyright_text",
    ):
        setattr(footer, field, getattr(data, field).strip())
    footer.donation_qr_media_id = data.donation_qr_media_id
    db.session.execute(SocialLink.__table__.delete())
    for i, s in enumerate(data.social_links):
        db.session.add(SocialLink(platform=s.platform, url=s.url.strip(), label=s.label.strip(), position=i))
    db.session.commit()
    if previous_qr and previous_qr != footer.donation_qr_media_id:
        delete_if_unreferenced({previous_qr})
    db.session.refresh(footer)
    result = serialize_footer(footer)
    result["donation_qr_media_id"] = footer.donation_qr_media_id
    return ok(result)
