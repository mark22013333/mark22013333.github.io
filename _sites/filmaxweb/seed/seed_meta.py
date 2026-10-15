#!/usr/bin/env python3
"""掃描完之後，替示範條目補上虛構的海報、簡介與分類（截圖用）。

示範環境沒有 TMDB_API_KEY（不連外部服務），掃描只會用檔名建條目。
這支腳本直接改「示範環境自己的」SQLite，把條目標成 manual
（＝後台手動修正過，app.js 不會顯示「未刮削」角標），並放上 Pillow 畫的海報。

用法：
    python3 seed_meta.py <FILMAX_DATA_DIR>

只會寫入 <FILMAX_DATA_DIR>/library.db 與 <FILMAX_DATA_DIR>/images/。可以重跑。
"""
import json
import os
import sqlite3
import sys
import time

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
if len(sys.argv) != 2:
    sys.exit(__doc__)
DATA = os.path.abspath(sys.argv[1])
DB = os.path.join(DATA, "library.db")
IMG = os.path.join(DATA, "images")
if not os.path.exists(DB):
    sys.exit(f"找不到 {DB}：先跑 run_demo.sh 並在網站上掃描一次")

# 依掃描出來的片名（檔名解析結果）對應虛構的 metadata
META = {
    "示範影片 甲": dict(title="示範影片 甲", genres=["劇情", "冒險"], rating=7.8, runtime=112,
                     colors=((255, 138, 101), (94, 53, 177)),
                     overview="虛構的示範條目。一段穿越測試圖樣的旅程，用來展示海報牆、詳細頁與播放器。"),
    "示範影片 乙": dict(title="示範影片 乙", genres=["劇情"], rating=7.1, runtime=98,
                     colors=((129, 212, 250), (13, 71, 161)),
                     overview="虛構的示範條目。mkv 容器的範例檔，瀏覽器無法直接播放時走 HLS。"),
    "範例紀錄片": dict(title="範例紀錄片", genres=["紀錄片"], rating=8.2, runtime=86,
                    colors=((165, 214, 167), (27, 94, 32)),
                    overview="虛構的示範條目。以碎形圖樣構成的紀錄片範例。"),
    "字幕示範": dict(title="字幕示範", genres=["劇情", "喜劇"], rating=6.9, runtime=104,
                  colors=((255, 224, 130), (230, 81, 0)),
                  overview="虛構的示範條目。內含一條 SRT 字幕軌，用來展示字幕即時轉成 WebVTT。"),
    "星圖觀測": dict(title="星圖觀測", genres=["科幻"], rating=7.5, runtime=121,
                  colors=((179, 157, 219), (26, 35, 126)),
                  overview="虛構的示範條目。"),
    "城市夜景": dict(title="城市夜景", genres=["劇情", "愛情"], rating=6.6, runtime=95,
                  colors=((244, 143, 177), (74, 20, 140)),
                  overview="虛構的示範條目。"),
    "海岸線": dict(title="海岸線", genres=["冒險"], rating=7.3, runtime=101,
                 colors=((128, 222, 234), (0, 96, 100)),
                 overview="虛構的示範條目。"),
    "ACME 年度回顧": dict(title="ACME 年度回顧", genres=["紀錄片"], rating=None, runtime=45,
                      colors=((207, 216, 220), (38, 50, 56)),
                      overview="虛構的示範條目。"),
    "影集": dict(title="示範影集", genres=["劇情", "懸疑"], rating=8.0, runtime=None,
               colors=((255, 171, 145), (183, 28, 28)),
               overview="虛構的示範影集，第一季三集。"),
}


def poster(name, title, colors, year):
    out = os.path.join(IMG, name)
    w, h = 500, 750
    a, b = colors
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im, "RGBA")
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3)))
    d.ellipse([w * 0.18, h * 0.16, w * 0.82, h * 0.16 + w * 0.64], fill=(255, 255, 255, 60))
    d.polygon([(0, h * 0.72), (w * 0.45, h * 0.46), (w, h * 0.70), (w, h), (0, h)],
              fill=(0, 0, 0, 70))
    f = ImageFont.truetype(FONT, 64 if len(title) <= 5 else 48)
    tw = d.textlength(title, font=f)
    d.text(((w - tw) / 2, h * 0.76), title, font=f, fill="white")
    if year:
        f2 = ImageFont.truetype(FONT, 28)
        s = str(year)
        d.text(((w - d.textlength(s, font=f2)) / 2, h * 0.76 + 84), s, font=f2,
               fill=(255, 255, 255, 200))
    im.save(out, "JPEG", quality=88)


con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
now = int(time.time())
n = 0
for row in con.execute("SELECT id, title, year FROM media_item").fetchall():
    m = META.get(row["title"]) or next(
        (v for v in META.values() if v["title"] == row["title"]), None)
    if not m:
        print("略過（沒有對應的示範資料）：", row["title"])
        continue
    name = f"demo_poster_{row['id']}.jpg"
    poster(name, m["title"], m["colors"], row["year"])
    con.execute("""UPDATE media_item SET title=?, sort_title=?, overview=?, poster=?,
                   rating=?, runtime=?, genres=?, scrape_state='manual', updated_at=?
                   WHERE id=?""",
                (m["title"], m["title"], m["overview"], name, m["rating"], m["runtime"],
                 json.dumps(m["genres"], ensure_ascii=False), now, row["id"]))
    n += 1
con.commit()
print(f"已更新 {n} 個條目")
