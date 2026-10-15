#!/usr/bin/env python3
"""把裁好的截圖往右補底色到最小寬度（就地覆寫）。

頁面上截圖一律撐滿欄寬（.term img{width:100%}），太窄的圖會被放大而變糊、字級也和其他張不一致。
以左上角像素當底色往右補，補到 MIN_W；原本就夠寬的圖不動。

用法：python3 pad_shots.py [--min-width N] a.png [b.png …]（預設 N=760；首屏大圖用 1120，與 sshm 一致）
"""
import sys

from PIL import Image

MIN_W = 760
args = sys.argv[1:]
if args[:1] == ["--min-width"]:
    MIN_W, args = int(args[1]), args[2:]

for path in args:
    with Image.open(path) as im:
        im.load()
        rgb = im.convert("RGB")
    w, h = rgb.size
    if w >= MIN_W:
        print("不需補寬：%s（%d×%d）" % (path, w, h))
        continue
    out = Image.new("RGB", (MIN_W, h), rgb.getpixel((0, 0)))
    out.paste(rgb, (0, 0))
    out.save(path, "PNG", optimize=True)
    print("已補寬：%s  %d×%d → %d×%d" % (path, w, h, MIN_W, h))
