#!/usr/bin/env python3
"""裁掉 TUI 截圖右側與下方的空白底色（就地覆寫）。

終端機截圖常是固定 1600×600，內容只佔左上角；頁面縮放後字小到讀不出來。
以左上角像素當底色，找出與底色不同的範圍，往右、往下各留 PAD 像素後裁切。
左、上不裁（截圖本來就貼齊左上，留著原本的邊距）。

用法：python3 tools/trim_shots.py _sites/<slug>/img/a.png [b.png …]
一次性整理原檔用；產生器不會自動裁，產出才能與 --check 逐位元組比對。
"""
import sys

from PIL import Image, ImageChops

PAD = 24       # 內容外保留的邊距
TOL = 12       # 與底色的容許差（抗鋸齒、壓縮雜訊）


def trim(path):
    with Image.open(path) as im:
        im.load()
        rgb = im.convert("RGB")
    bg = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    diff = ImageChops.difference(rgb, bg).convert("L").point(lambda v: 255 if v > TOL else 0)
    box = diff.getbbox()
    if not box:
        print("略過（整張都是底色）：%s" % path)
        return
    w, h = im.size
    right, bottom = min(w, box[2] + PAD), min(h, box[3] + PAD)
    if (right, bottom) == (w, h):
        print("不需裁切：%s（%d×%d）" % (path, w, h))
        return
    im.crop((0, 0, right, bottom)).save(path, "PNG", optimize=True)
    print("已裁切：%s  %d×%d → %d×%d" % (path, w, h, right, bottom))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for p in sys.argv[1:]:
        trim(p)
