#!/usr/bin/env python3
"""作品介紹官網產生器。

讀 _sites/<slug>/content.yml ＋ _sites/_template/page.html，產生：
  <slug>/index.html   介紹頁
  <slug>/img/         截圖（從 _sites/<slug>/img/ 複製）
  <slug>/og.png       OG 分享圖（首屏主截圖等比放大後從左上裁成 1200×630）
並把 content.yml 的 tagline 寫回 projects.json 中 "site": "<slug>" 那筆的 desc。

用法：
  python3 tools/build_sites.py            產生全部專案
  python3 tools/build_sites.py sshm       只產生指定專案
  python3 tools/build_sites.py --check    重新產生到暫存目錄並與 repo 內產出比對，過期則 exit 1

依賴：PyYAML（解析 content.yml）、Pillow（讀圖檔尺寸、裁 OG 圖）。

規則：content.yml 引用的任一截圖不存在 → 該專案報錯並略過（不產生半成品頁），最後 exit 1。
"""

import argparse
import filecmp
import html
import json
import os
import re
import shutil
import sys
import tempfile

try:
    import yaml
except ImportError:
    sys.exit("缺少 PyYAML：python3 -m pip install --user pyyaml")
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("缺少 Pillow：python3 -m pip install --user pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = os.path.join(ROOT, "_sites")
TEMPLATE = os.path.join(SITES, "_template", "page.html")
PROJECTS_JSON = os.path.join(ROOT, "projects.json")

PORTAL_URL = "https://mark22013333.github.io/"
OG_SIZE = (1200, 630)
# OG 圖上「介面示意」標註用的中文字型（依序找第一個存在的）
OG_FONTS = ["/System/Library/Fonts/STHeiti Medium.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"]
OG_MOCK_LABEL = "介面示意（依原始碼重繪）"

ICONS = {
    "download": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    "github": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
    "external": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
}


class SiteError(Exception):
    """單一專案的內容錯誤（缺圖、缺欄位）：該專案略過，不中止其他專案。"""


# ---------------------------------------------------------------- 迷你模板引擎
# 語法：{{ a.b }}（HTML 跳脫）、{{ a.b|raw }}（原樣輸出）、
#       {% if a.b %}…{% else %}…{% endif %}（if 可接 not）、{% for x in a.b %}…{% endfor %}

_TOKEN = re.compile(r"({{.*?}}|{%.*?%})", re.S)


def _lookup(ctx, path):
    cur = ctx
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
        if cur is None:
            return None
    return cur


def _parse(tokens, i, stop):
    nodes = []
    while i < len(tokens):
        t = tokens[i]
        if t.startswith("{%"):
            tag = t[2:-2].strip()
            word = tag.split()[0]
            if word in stop:
                return nodes, i, tag
            if word == "if":
                body, i, end = _parse(tokens, i + 1, ("else", "endif"))
                orelse = []
                if end == "else":
                    orelse, i, end = _parse(tokens, i + 1, ("endif",))
                nodes.append(("if", tag[2:].strip(), body, orelse))
            elif word == "for":
                m = re.match(r"for\s+(\w+)\s+in\s+([\w.]+)$", tag)
                if not m:
                    raise ValueError("模板語法錯誤：" + tag)
                body, i, _ = _parse(tokens, i + 1, ("endfor",))
                nodes.append(("for", m.group(1), m.group(2), body))
            else:
                raise ValueError("模板未知標籤：" + tag)
        elif t.startswith("{{"):
            expr = t[2:-2].strip()
            raw = expr.endswith("|raw")
            nodes.append(("var", expr[:-4].strip() if raw else expr, raw))
        else:
            nodes.append(("text", t))
        i += 1
    if stop:
        raise ValueError("模板缺少結尾標籤：" + "/".join(stop))
    return nodes, i, None


def _render(nodes, ctx):
    out = []
    for n in nodes:
        kind = n[0]
        if kind == "text":
            out.append(n[1])
        elif kind == "var":
            v = _lookup(ctx, n[1])
            if v is None:
                raise ValueError("模板變數沒有值：" + n[1])
            v = str(v)
            out.append(v if n[2] else html.escape(v, quote=True))
        elif kind == "if":
            cond = n[1]
            neg = cond.startswith("not ")
            val = bool(_lookup(ctx, cond[4:].strip() if neg else cond))
            out.append(_render(n[2] if val != neg else n[3], ctx))
        elif kind == "for":
            for item in _lookup(ctx, n[2]) or []:
                out.append(_render(n[3], dict(ctx, **{n[1]: item})))
    return "".join(out)


def render_template(text, ctx):
    tokens = [t for t in _TOKEN.split(text) if t != ""]
    nodes, _, _ = _parse(tokens, 0, ())
    return _render(nodes, ctx)


# ---------------------------------------------------------------- 內容轉換

def code_html(text, highlight=()):
    """純文字程式碼 → 上色 HTML。「$ 」開頭加提示字元；# 開頭或空兩格以上再接 # 的部分為註解。"""
    lines = []
    for line in text.rstrip("\n").split("\n"):
        prompt, comment, gap = "", "", ""
        body = line
        if body.lstrip().startswith("#"):
            body, comment = "", line
        else:
            m = re.match(r"^(.*?\S)(\s{2,})(#.*)$", body)
            if m:
                body, gap, comment = m.group(1), m.group(2), m.group(3)
            if body.startswith("$ "):
                prompt, body = "$ ", body[2:]
        b = html.escape(body, quote=False)
        for h in highlight:
            hh = html.escape(h, quote=False)
            b = b.replace(hh, '<span class="a">' + hh + "</span>")
        s = ""
        if prompt:
            s += '<span class="p">$ </span>'
        s += b + gap
        if comment:
            s += '<span class="c">' + html.escape(comment, quote=False) + "</span>"
        lines.append(s)
    return "\n".join(lines)


def _req(d, key, where):
    v = d.get(key) if isinstance(d, dict) else None
    if v in (None, "", []):
        raise SiteError("缺少必填欄位 %s.%s" % (where, key))
    return v


def _image(slug, name, alt, bar, used, where, mock=False):
    """mock=True：依原始碼重繪的示意圖（非實際截圖），頁面會在視窗標題列標註。"""
    if not name:
        raise SiteError("%s 沒有指定截圖" % where)
    if not alt:
        raise SiteError("%s 缺少 alt" % where)
    path = os.path.join(SITES, slug, "img", name)
    if not os.path.isfile(path):
        raise SiteError("%s 的截圖不存在：%s" % (where, os.path.relpath(path, ROOT)))
    with Image.open(path) as im:
        w, h = im.size
    used.append(name)
    return {"src": "img/" + name, "width": w, "height": h, "alt": alt, "bar": bar or "", "path": path,
            "mock": bool(mock)}


def build_context(slug, c):
    if c.get("slug") != slug:
        raise SiteError("content.yml 的 slug（%r）與目錄名稱不同" % c.get("slug"))
    if slug != slug.lower() or not re.match(r"^[a-z0-9][a-z0-9-]*$", slug):
        raise SiteError("slug 必須是小寫英數與連字號：%r" % slug)
    for k in ("name", "tagline", "accent", "hero", "buttons", "features", "install"):
        _req(c, k, "content")

    used = []
    ctx = {
        "slug": slug,
        "name": c["name"],
        "tagline": c["tagline"].strip(),
        "accent": c["accent"],
        "meta_description": "%s：%s" % (c["name"], c["tagline"].strip()),
        "page_url": PORTAL_URL + slug + "/",
        "og_url": PORTAL_URL + slug + "/og.png",
        "portal_url": PORTAL_URL,
        "lede": c.get("lede"),
        "requirements": c.get("requirements"),
        "brand_bars": c.get("brand_bars") or [],
        "footer_note": c.get("footer_note"),
    }
    if not re.match(r"^#[0-9a-fA-F]{3,8}$", str(c["accent"])):
        raise SiteError("accent 必須是 #RRGGBB 色碼：%r" % c["accent"])

    eb = c.get("eyebrow") or {}
    parts = []
    if eb.get("kind"):
        parts.append("<b>%s</b>" % html.escape(eb["kind"]))
    parts += [html.escape(str(m)) for m in eb.get("meta") or []]
    ctx["eyebrow_html"] = " · ".join(parts)

    buttons = []
    for i, b in enumerate(c["buttons"]):
        url = _req(b, "url", "buttons[%d]" % i)
        icon = b.get("icon") or ("github" if "github.com" in url else "download" if url.startswith("#") else "external")
        if icon not in ICONS:
            raise SiteError("buttons[%d].icon 不支援：%r（可用 %s）" % (i, icon, "、".join(ICONS)))
        buttons.append({
            "label": _req(b, "label", "buttons[%d]" % i),
            "url": url,
            "style": b.get("style") or ("primary" if i == 0 else "ghost"),
            "icon_svg": ICONS[icon],
        })
    ctx["buttons"] = buttons

    h = c["hero"]
    ctx["hero"] = _image(slug, h.get("image"), h.get("alt"), h.get("bar"), used, "hero", mock=h.get("mock"))
    ctx["hero"]["caption"] = h.get("caption")

    nav, blocks_before, blocks_after = [], [], []

    f = c["features"]
    items = _req(f, "items", "features")
    feat = {
        "is_features": True,
        "id": f.get("id") or "features",
        "comment": "功能",
        "kicker": _req(f, "kicker", "features"),
        "title": _req(f, "title", "features"),
        "intro": f.get("intro"),
        "items": [],
    }
    for i, it in enumerate(items):
        where = "features.items[%d]" % i
        feat["items"].append({
            "number": "%02d" % (i + 1),
            "label": _req(it, "label", where),
            "title": _req(it, "title", where),
            "paragraphs": it.get("paragraphs") or [],
            "bullets": it.get("bullets") or [],
            "flip": i % 2 == 1,
            "image": _image(slug, it.get("image"), it.get("alt"), it.get("bar"), used, where, mock=it.get("mock")),
        })
    feat_nav = {"id": feat["id"], "label": f.get("nav"), "optional": f.get("nav_optional", False)}

    for i, s in enumerate(c.get("sections") or []):
        where = "sections[%d]" % i
        typ = _req(s, "type", where)
        if typ not in ("split", "cards"):
            raise SiteError("%s.type 只支援 split／cards：%r" % (where, typ))
        blk = {
            "is_split": typ == "split",
            "is_cards": typ == "cards",
            "id": _req(s, "id", where),
            "kicker": _req(s, "kicker", where),
            "comment": re.sub(r"^/+\s*", "", s["kicker"]),
            "title": _req(s, "title", where),
            "intro": s.get("intro"),
            "paragraphs": s.get("paragraphs") or [],
            "note": s.get("note"),
            "cards": s.get("cards") or [],
            "code": None,
            "image": None,
        }
        if s.get("code"):
            blk["code"] = {"label": s["code"].get("label") or "",
                           "html": code_html(_req(s["code"], "text", where + ".code"), s["code"].get("highlight") or [])}
        if s.get("image"):
            blk["image"] = _image(slug, s.get("image"), s.get("alt"), s.get("bar"), used, where, mock=s.get("mock"))
        if typ == "cards" and not blk["cards"]:
            raise SiteError("%s 是 cards 但沒有 cards" % where)
        pos = s.get("position") or "before_install"
        if pos not in ("before_install", "after_install"):
            raise SiteError("%s.position 只能是 before_install／after_install" % where)
        (blocks_before if pos == "before_install" else blocks_after).append((blk, s))

    ins = c["install"]
    inst = {
        "is_install": True,
        "id": ins.get("id") or "install",
        "comment": "安裝",
        "kicker": _req(ins, "kicker", "install"),
        "title": _req(ins, "title", "install"),
        "intro": ins.get("intro"),
        "code": None,
        "steps": ins.get("steps") or [],
        "side": None,
    }
    if ins.get("code"):
        inst["code"] = {"label": ins["code"].get("label") or "",
                        "html": code_html(_req(ins["code"], "text", "install.code"), ins["code"].get("highlight") or [])}
    if ins.get("side"):
        sd = ins["side"]
        inst["side"] = {"title": _req(sd, "title", "install.side"), "items": sd.get("items") or [],
                        "caption": sd.get("caption"), "image": None}
        if sd.get("image"):
            inst["side"]["image"] = _image(slug, sd.get("image"), sd.get("alt"), sd.get("bar"), used, "install.side", mock=sd.get("mock"))

    blocks = [feat] + [b for b, _ in blocks_before] + [inst] + [b for b, _ in blocks_after]
    ctx["blocks"] = blocks

    nav_src = [(feat, feat_nav)] + [(b, {"id": b["id"], "label": s.get("nav"), "optional": s.get("nav_optional", False)}) for b, s in blocks_before] \
        + [(inst, {"id": inst["id"], "label": ins.get("nav"), "optional": ins.get("nav_optional", False)})] \
        + [(b, {"id": b["id"], "label": s.get("nav"), "optional": s.get("nav_optional", False)}) for b, s in blocks_after]
    ctx["nav"] = [n for _, n in nav_src if n["label"]]

    ids = [b["id"] for b in blocks]
    if len(ids) != len(set(ids)):
        raise SiteError("區塊 id 重複：%s" % ids)

    links = c.get("footer_links")
    if not links:
        gh = _req(c, "github", "content（footer_links 省略時需要 github）")
        links = [{"label": "GitHub", "url": gh}, {"label": "回作品集", "url": PORTAL_URL}]
    ctx["footer_links"] = [{"label": _req(l, "label", "footer_links"), "url": _req(l, "url", "footer_links")} for l in links]
    return ctx, used


def make_og(src, dst, mock=False):
    """等比放大到蓋滿 1200×630，再從左上裁切。

    mock=True（主圖是重繪示意圖）時在右下角加上標註，分享出去也看得出不是實際截圖。
    """
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        scale = max(OG_SIZE[0] / w, OG_SIZE[1] / h)
        nw, nh = round(w * scale), round(h * scale)
        im = im.resize((nw, nh), Image.LANCZOS).crop((0, 0) + OG_SIZE)
        if mock:
            _draw_mock_label(im)
        im.save(dst, "PNG")


def _draw_mock_label(im):
    font_path = next((f for f in OG_FONTS if os.path.isfile(f)), None)
    if not font_path:
        raise SiteError("找不到可畫中文標註的字型（OG_FONTS），無法產生示意圖的 OG 圖")
    font = ImageFont.truetype(font_path, 30)
    d = ImageDraw.Draw(im)
    l, t, r, b = d.textbbox((0, 0), OG_MOCK_LABEL, font=font)
    pad_x, pad_y, margin = 20, 12, 28
    w, h = r - l + pad_x * 2, b - t + pad_y * 2
    x0, y0 = OG_SIZE[0] - margin - w, OG_SIZE[1] - margin - h
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=10, fill=(20, 20, 28), outline=(230, 180, 80), width=3)
    d.text((x0 + pad_x - l, y0 + pad_y - t), OG_MOCK_LABEL, font=font, fill=(230, 180, 80))


def build_site(slug, out_root, template):
    path = os.path.join(SITES, slug, "content.yml")
    with open(path, encoding="utf-8") as fh:
        c = yaml.safe_load(fh) or {}
    ctx, used = build_context(slug, c)
    page = render_template(template, ctx)

    # 全部檢查通過才開始寫檔，避免半成品
    dst = os.path.join(out_root, slug)
    os.makedirs(os.path.join(dst, "img"), exist_ok=True)
    for name in sorted(set(used)):
        shutil.copyfile(os.path.join(SITES, slug, "img", name), os.path.join(dst, "img", name))
    make_og(ctx["hero"]["path"], os.path.join(dst, "og.png"), mock=ctx["hero"]["mock"])
    with open(os.path.join(dst, "index.html"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(page)
    return ctx["tagline"]


def update_projects_json(src_text, taglines):
    """只改有 "site" 欄位那幾筆的 desc，其餘文字原樣保留。"""
    data = json.loads(src_text)
    out = src_text
    for obj_text in re.findall(r"\{[^{}]*\}", src_text):
        try:
            obj = json.loads(obj_text)
        except ValueError:
            continue
        site = obj.get("site")
        if not site or site not in taglines:
            continue
        new_desc = json.dumps(taglines[site], ensure_ascii=False)
        new_obj, n = re.subn(r'("desc"\s*:\s*)"(?:[^"\\]|\\.)*"', lambda m: m.group(1) + new_desc, obj_text, count=1)
        if n == 0:
            new_obj = re.sub(r"\s*\}$", ',\n      "desc": %s }' % new_desc, obj_text)
        out = out.replace(obj_text, new_obj, 1)
    json.loads(out)  # 確認仍是合法 JSON
    sites_in_json = {p.get("site") for p in data.get("projects", []) if p.get("site")}
    return out, sites_in_json


def list_slugs():
    return sorted(d for d in os.listdir(SITES)
                  if not d.startswith(("_", ".")) and os.path.isfile(os.path.join(SITES, d, "content.yml")))


def run(out_root, slugs, projects_out, quiet=False):
    with open(TEMPLATE, encoding="utf-8") as fh:
        template = fh.read()
    taglines, failed = {}, []
    for slug in slugs:
        try:
            taglines[slug] = build_site(slug, out_root, template)
            if not quiet:
                print("✓ %s → %s/index.html" % (slug, slug))
        except SiteError as e:
            failed.append(slug)
            print("✗ %s：%s（略過，未產生頁面）" % (slug, e), file=sys.stderr)
    with open(PROJECTS_JSON, encoding="utf-8") as fh:
        src = fh.read()
    new, sites_in_json = update_projects_json(src, taglines)
    for slug in taglines:
        if slug not in sites_in_json:
            print("! projects.json 沒有 \"site\": \"%s\" 的卡片，入口網站不會連到這頁" % slug, file=sys.stderr)
    if new != src or projects_out != PROJECTS_JSON:
        with open(projects_out, "w", encoding="utf-8", newline="") as fh:
            fh.write(new)
    return failed


def _same_file(a, b):
    if a.endswith(".png") and os.path.basename(a) == "og.png":
        # OG 圖比對像素，不比位元組（不同 Pillow 版本的 PNG 壓縮輸出可能不同）
        with Image.open(a) as x, Image.open(b) as y:
            return x.size == y.size and x.convert("RGB").tobytes() == y.convert("RGB").tobytes()
    return filecmp.cmp(a, b, shallow=False)


def check(slugs):
    stale = []
    with tempfile.TemporaryDirectory(prefix="build_sites_check_") as tmp:
        pj = os.path.join(tmp, "projects.json")
        failed = run(tmp, slugs, pj, quiet=True)
        if failed:
            print("✗ 有專案產生失敗：%s" % "、".join(failed), file=sys.stderr)
            return 1
        if not filecmp.cmp(pj, PROJECTS_JSON, shallow=False):
            stale.append("projects.json")
        for slug in slugs:
            gen_dir, repo_dir = os.path.join(tmp, slug), os.path.join(ROOT, slug)
            gen = {os.path.relpath(os.path.join(d, f), gen_dir) for d, _, fs in os.walk(gen_dir) for f in fs}
            have = {os.path.relpath(os.path.join(d, f), repo_dir) for d, _, fs in os.walk(repo_dir) for f in fs} \
                if os.path.isdir(repo_dir) else set()
            for rel in sorted(gen):
                if rel not in have:
                    stale.append("%s/%s（缺少）" % (slug, rel))
                elif not _same_file(os.path.join(gen_dir, rel), os.path.join(repo_dir, rel)):
                    stale.append("%s/%s（內容過期）" % (slug, rel))
            for rel in sorted(have - gen):
                stale.append("%s/%s（多出來的檔案，產生器不會產生它）" % (slug, rel))
    if stale:
        print("✗ 產出與 _sites/ 不一致，請執行 python3 tools/build_sites.py 後再提交：", file=sys.stderr)
        for s in stale:
            print("  - " + s, file=sys.stderr)
        return 1
    print("✓ 產出與 _sites/ 一致（%s）" % "、".join(slugs))
    return 0


def main():
    ap = argparse.ArgumentParser(description="產生作品介紹官網")
    ap.add_argument("slugs", nargs="*", help="只處理指定專案（預設全部）")
    ap.add_argument("--check", action="store_true", help="只比對，不寫入 repo；過期則 exit 1")
    args = ap.parse_args()
    all_slugs = list_slugs()
    slugs = args.slugs or all_slugs
    unknown = [s for s in slugs if s not in all_slugs]
    if unknown:
        sys.exit("找不到 _sites/<slug>/content.yml：%s" % "、".join(unknown))
    if args.check:
        sys.exit(check(slugs))
    failed = run(ROOT, slugs, PROJECTS_JSON)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
