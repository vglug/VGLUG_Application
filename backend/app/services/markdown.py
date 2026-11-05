"""Trusted Markdown rendering boundary.

Raw HTML in Markdown is disabled (it is escaped, never executed), and the rendered
output is then passed through an nh3 allow-list so that no script, event handler,
style injection or unsafe URL scheme can reach the browser.
"""

import re

import nh3
from markdown_it import MarkdownIt

VIDEO_SRC_RE = re.compile(r"^/media/[A-Za-z0-9/_\-]+\.(mp4|webm)$")
MEDIA_REF_RE = re.compile(r"/media/([a-z\-]+/[A-Za-z0-9_\-]+\.[a-z0-9]{2,5})")

ALLOWED_TAGS = {
    "p", "br", "hr", "h2", "h3", "h4", "h5", "h6", "strong", "em", "del", "s", "code", "pre",
    "blockquote", "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "video", "figure", "figcaption",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "img": {"src", "alt", "title", "loading", "decoding"},
    "video": {"src", "controls", "preload", "playsinline", "title"},
    "ol": {"start"},
    "th": {"style"},
    "td": {"style"},
}


def _build_parser() -> MarkdownIt:
    md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": True})
    md.enable(["table", "strikethrough"])

    default_image = md.renderer.rules["image"]

    def render_image(self, tokens, idx, options, env):
        token = tokens[idx]
        src = token.attrGet("src") or ""
        if VIDEO_SRC_RE.match(src):
            title = md.utils.escapeHtml(token.content or "Video")
            return (
                f'<figure><video src="{md.utils.escapeHtml(src)}" controls preload="metadata" playsinline '
                f'title="{title}"></video>'
                + (f"<figcaption>{title}</figcaption>" if token.content else "")
                + "</figure>"
            )
        token.attrSet("loading", "lazy")
        token.attrSet("decoding", "async")
        return default_image(tokens, idx, options, env)

    def heading_open(self, tokens, idx, options, env):
        # The page title is the only <h1>; demote body headings by one level.
        token = tokens[idx]
        level = min(6, int(token.tag[1]) + 1) if token.tag == "h1" else int(token.tag[1])
        token.tag = f"h{max(2, level)}"
        return md.renderer.renderToken(tokens, idx, options, env)

    def heading_close(self, tokens, idx, options, env):
        token = tokens[idx]
        level = int(token.tag[1])
        token.tag = f"h{max(2, min(6, level + 1 if level == 1 else level))}"
        return md.renderer.renderToken(tokens, idx, options, env)

    md.add_render_rule("image", render_image)
    md.add_render_rule("heading_open", heading_open)
    md.add_render_rule("heading_close", heading_close)
    return md


_md = _build_parser()


def sanitize_html(html: str) -> str:
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer nofollow",
        filter_style_properties={"text-align"},
        strip_comments=True,
    )


def render_markdown(text: str) -> str:
    if not text:
        return ""
    return sanitize_html(_md.render(text))


def extract_media_paths(*texts: str) -> set[str]:
    """Relative media paths (e.g. 'blogs/abc.jpg') referenced from Markdown."""
    found = set()
    for text in texts:
        if text:
            found.update(MEDIA_REF_RE.findall(text))
    return found


def plain_excerpt(text: str, length: int = 200) -> str:
    stripped = re.sub(r"[#>*_`\[\]()!|~-]+", " ", text or "")
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return stripped if len(stripped) <= length else stripped[: length - 1].rsplit(" ", 1)[0] + "…"
