#!/usr/bin/env python3
"""把 github.io 上的舊 Hexo 部落格轉成「轉址殘頁」（一次性工具，2026-09-26 搬家用）。

- 每個舊 HTML 頁面換成極小的殘頁：meta refresh 0 + canonical + JS（保留 query 與 #錨點），
  轉到 https://blog.longhopick.com 的同一路徑。permalink 在新站維持不變，路徑可一一對應。
- 舊站其餘檔案（css/js/img/search.xml…）移除；sitemap.xml 保留，讓搜尋引擎重新爬到轉址。
- 根目錄 index.html、404.html、atom.xml、robots.txt 由入口網站提供，這裡不產生。

只處理 git 追蹤中的檔案，執行前請先在 HEAD 打 tag（blog-final-20260926），出錯可整包還原。
"""
import html
import os
import re
import subprocess
import sys

NEW_ORIGIN = "https://blog.longhopick.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 入口網站自己的檔案與要保留的舊檔
KEEP = {"sitemap.xml", "tools/make_stubs.py"}
PORTAL_OWNED = {"index.html", "404.html", "atom.xml", "robots.txt"}

TEMPLATE = """<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="canonical" href="{url}">
<meta http-equiv="refresh" content="0; url={url}">
<script>location.replace({url_js} + location.search + location.hash);</script>
</head>
<body>
<p>這個頁面已搬到 <a href="{url}">{url}</a></p>
</body>
</html>
"""


def tracked_files():
    out = subprocess.run(["git", "-C", ROOT, "ls-files", "-z"], check=True,
                         capture_output=True).stdout.decode()
    return [p for p in out.split("\0") if p]


def page_url(rel):
    # 2026/09/23/slug/index.html -> /2026/09/23/slug/；music.html -> /music.html
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def old_title(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        head = f.read(20000)
    m = re.search(r"<title>(.*?)</title>", head, re.S | re.I)
    return html.unescape(m.group(1).strip()) if m else "頁面已搬家"


def main():
    files = tracked_files()
    stubs = removed = 0
    for rel in files:
        if rel in KEEP or rel in PORTAL_OWNED:
            continue
        path = os.path.join(ROOT, rel)
        if rel.endswith(".html"):
            url = NEW_ORIGIN + page_url(rel)
            title = old_title(path)
            with open(path, "w", encoding="utf-8") as f:
                f.write(TEMPLATE.format(title=html.escape(title), url=html.escape(url, quote=True),
                                        url_js=repr(url)))
            stubs += 1
        else:
            os.remove(path)
            removed += 1
    print(f"殘頁 {stubs} 個、移除非 HTML 檔 {removed} 個（總追蹤檔 {len(files)}）")
    if stubs == 0:
        sys.exit("沒有產生任何殘頁，停止")


if __name__ == "__main__":
    main()
