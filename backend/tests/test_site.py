def test_seeded_nav_order(client, seeded):
    nav = client.get("/api/site").get_json()["data"]["nav"]
    assert [i["label"] for i in nav] == ["Home", "Explore", "About Us", "Join Us", "Contact Us"]
    assert [c["label"] for c in nav[1]["children"]] == ["Meetups", "Events", "Blogs"]
    assert nav[3]["url"] == "/join"


def test_seeded_pages_are_drafts_until_published(client, admin):
    assert client.get("/api/pages/about").status_code == 404
    page = admin.get("/api/admin/pages/about").get_json()["data"]
    assert "2013" in page["intro_md"]
    headings = [s["heading"] for s in page["sections"]]
    assert "Recognitions and awards" in headings


def _page_payload(page, **changes):
    payload = {
        "title": page["title"], "eyebrow": page["eyebrow"], "intro_md": page["intro_md"],
        "cta_label": page["cta_label"], "cta_url": page["cta_url"], "status": page["status"],
        "sections": [
            {"anchor": s["anchor"], "layout": s["layout"], "heading": s["heading"], "body_md": s["body_md"],
             "is_visible": s["is_visible"],
             "items": [{"title": i["title"], "subtitle": i["subtitle"], "body_md": i["body_md"], "url": i["url"]} for i in s["items"]]}
            for s in page["sections"]
        ],
    }
    payload.update(changes)
    return payload


def test_join_page_management(client, admin):
    page = admin.get("/api/admin/pages/join").get_json()["data"]
    bad = admin.put("/api/admin/pages/join", json=_page_payload(page, cta_label="Apply", cta_url="javascript:alert(1)"))
    assert bad.status_code == 422 and "cta_url" in bad.get_json()["error"]["fields"]

    r = admin.put("/api/admin/pages/join", json=_page_payload(
        page, status="published", cta_label="Apply now", cta_url="https://forms.example.org/vglug"))
    assert r.status_code == 200
    public = client.get("/api/pages/join").get_json()["data"]
    assert public["cta_url"] == "https://forms.example.org/vglug"
    assert "intro_md" not in public and public["intro_html"].startswith("<p>")

    hidden = _page_payload(page, status="published")
    hidden["sections"][0]["is_visible"] = False
    admin.put("/api/admin/pages/join", json=hidden)
    assert len(client.get("/api/pages/join").get_json()["data"]["sections"]) == len(page["sections"]) - 1

    admin.put("/api/admin/pages/join", json=_page_payload(page, status="draft"))
    assert client.get("/api/pages/join").status_code == 404


def _nav_payload(tree):
    def strip(i):
        return {k: (v if k != "children" else [strip(c) for c in v]) for k, v in i.items() if k != "id"}
    return {"items": [strip(i) for i in tree]}


def test_navigation_management(client, admin):
    tree = admin.get("/api/admin/navigation").get_json()["data"]["main"]
    payload = _nav_payload(tree)
    payload["items"][3]["label"] = "Become a member"
    payload["items"].append({"label": "Wiki", "url": "https://wiki.example.org", "is_visible": True,
                             "open_in_new_tab": True, "children": []})
    r = admin.put("/api/admin/navigation/main", json=payload)
    assert r.status_code == 200, r.get_json()
    nav = client.get("/api/site").get_json()["data"]["nav"]
    assert nav[3]["label"] == "Become a member" and nav[3]["url"] == "/join"
    assert nav[-1]["url"] == "https://wiki.example.org"

    # System routes cannot be removed, hidden (Join) or re-pointed; unsafe links are refused.
    no_join = {"items": [i for i in payload["items"] if i.get("system_key") != "join"]}
    assert admin.put("/api/admin/navigation/main", json=no_join).status_code == 422
    hidden = _nav_payload(tree)
    hidden["items"][3]["is_visible"] = False
    assert admin.put("/api/admin/navigation/main", json=hidden).status_code == 422
    unsafe = _nav_payload(tree)
    unsafe["items"].append({"label": "x", "url": "javascript:alert(1)", "children": []})
    assert admin.put("/api/admin/navigation/main", json=unsafe).status_code == 422
    repointed = _nav_payload(tree)
    repointed["items"][2]["url"] = "https://evil.example"
    admin.put("/api/admin/navigation/main", json=repointed)
    assert client.get("/api/site").get_json()["data"]["nav"][2]["url"] == "/about"
    moved = _nav_payload(tree)
    moved["items"].append(moved["items"][1]["children"].pop())
    assert admin.put("/api/admin/navigation/main", json=moved).status_code == 422


def test_footer_management(client, admin):
    footer = admin.get("/api/admin/footer").get_json()["data"]
    assert footer["email"] == "" and footer["registration_id"] == ""  # never invented
    payload = {
        "org_name": "Viluppuram GNU/Linux Users Group", "email": "hello@example.org", "phone": "+91 00000 00000",
        "social_links": [{"platform": "github", "url": "https://github.com/example", "label": "GitHub"}],
    }
    r = admin.put("/api/admin/footer", json=payload)
    assert r.status_code == 200
    site = client.get("/api/site").get_json()["data"]["footer"]
    assert site["email"] == "hello@example.org" and site["social_links"][0]["platform"] == "github"

    bad = admin.put("/api/admin/footer", json={**payload, "email": "nope", "social_links": [
        {"platform": "github", "url": "javascript:alert(1)"}]})
    fields = bad.get_json()["error"]["fields"]
    assert "email" in fields and "social_links.0.url" in fields
    assert admin.put("/api/admin/footer", json={**payload, "social_links": [
        {"platform": "myspace", "url": "https://x.example"}]}).status_code == 422


def test_seeded_footer_has_official_channels(client, seeded):
    footer = client.get("/api/site").get_json()["data"]["footer"]
    platforms = [s["platform"] for s in footer["social_links"]]
    assert {"telegram", "github", "youtube"} <= set(platforms)
    assert footer["phone"] and footer["email"] == "" and footer["donation_qr"] is None


def test_link_items_are_validated(client, admin):
    page = admin.get("/api/admin/pages/home").get_json()["data"]
    payload = _page_payload(page, status="published")
    links = next(s for s in payload["sections"] if s["layout"] == "links")
    links["items"][0]["url"] = "javascript:alert(1)"
    r = admin.put("/api/admin/pages/home", json=payload)
    assert r.status_code == 422 and any(k.endswith(".items.0.url") for k in r.get_json()["error"]["fields"])
    links["items"][0]["url"] = "https://glugucev.wordpress.com"
    assert admin.put("/api/admin/pages/home", json=payload).status_code == 200
    public = client.get("/api/pages/home").get_json()["data"]
    assert any(i["url"] == "https://glugucev.wordpress.com" for s in public["sections"] for i in s["items"])
