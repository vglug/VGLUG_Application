from app.services.markdown import extract_media_paths, render_markdown


def test_raw_html_and_scripts_are_not_executed():
    html = render_markdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">')
    assert "<script" not in html and "<img" not in html
    assert "&lt;script&gt;" in html  # escaped as text


def test_unsafe_links_removed():
    html = render_markdown("[click](javascript:alert(1)) [data](data:text/html,hi) [ok](https://example.org)")
    assert "href=\"javascript" not in html and "href=\"data:" not in html
    assert 'href="https://example.org"' in html
    assert 'rel="noopener noreferrer nofollow"' in html


def test_images_lazy_and_video_embed():
    html = render_markdown("![A cat](/media/blogs/abc.png)\n\n![Demo video](/media/blogs/def.mp4)")
    assert 'loading="lazy"' in html and 'alt="A cat"' in html
    assert '<video src="/media/blogs/def.mp4"' in html and "controls" in html


def test_only_local_media_can_be_video():
    html = render_markdown("![x](https://evil.example/v.mp4)")
    assert "<video" not in html


def test_heading_levels_demoted():
    html = render_markdown("# Top\n\n## Second")
    assert "<h1" not in html and "<h2>Top</h2>" in html


def test_extract_media_paths():
    assert extract_media_paths("![a](/media/blogs/abc.png) and /media/events/x_y.webm") == {
        "blogs/abc.png", "events/x_y.webm"}
