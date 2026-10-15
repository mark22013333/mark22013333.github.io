#!/usr/bin/env python3
"""產生 FilmaxWeb 截圖用的虛構媒體素材（影片／相片／PDF）。

全部是程式產生的色塊、漸層、測試圖樣，不取用任何既有的影片或相片。

用法：
    python3 gen_media.py <輸出的 FTP 根目錄>

需要：Pillow、ffmpeg（預設 /opt/homebrew/bin/ffmpeg，可用 FFMPEG 環境變數改）。
已存在的檔案會略過，可以重跑。
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

FFMPEG = os.environ.get("FFMPEG", "/opt/homebrew/bin/ffmpeg")
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"

if len(sys.argv) != 2:
    sys.exit(__doc__)
ROOT = os.path.abspath(sys.argv[1])


def path(rel):
    full = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    return full


def ff(rel, args):
    out = path(rel)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y"] + args + [out]
    subprocess.run(cmd, check=True)
    print("影片", rel)


# ---------------------------------------------------------------- 影片
# 測試圖樣＋正弦波音軌，數秒長。容器與編碼刻意混搭，對應 README 的三條播放路徑。
SRC = {
    "testsrc2": "testsrc2=size=1280x720:rate=24",
    "smpte": "smptehdbars=size=1280x720:rate=24",
    "mandel": "mandelbrot=size=1280x720:rate=24",
    "life": "life=size=1280x720:rate=24:mold=10:ratio=0.3",
    "rgb": "rgbtestsrc=size=1280x720:rate=24",
    "yuv": "yuvtestsrc=size=1280x720:rate=24",
    "plain": "testsrc=size=1280x720:rate=24",
}


def video(rel, src, secs=8, container_args=()):
    ff(rel, ["-f", "lavfi", "-i", SRC[src],
             "-f", "lavfi", "-i", "sine=frequency=440", "-t", str(secs),
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
             "-c:a", "aac", "-b:a", "96k", "-shortest", *container_args])


video("電影/示範影片 甲 (2023)/示範影片 甲 (2023).mp4", "testsrc2", 10,
      ["-movflags", "+faststart"])
video("電影/範例紀錄片 (2019)/範例紀錄片 (2019).mp4", "mandel", 8,
      ["-movflags", "+faststart"])
video("電影/示範影片 乙 (2021)/示範影片 乙 (2021).mkv", "smpte", 8)
video("電影/星圖觀測 (2020)/星圖觀測 (2020).mkv", "life", 8)
video("電影/城市夜景 (2018)/城市夜景 (2018).mp4", "rgb", 4, ["-movflags", "+faststart"])
video("電影/海岸線 (2024)/海岸線 (2024).mp4", "yuv", 4, ["-movflags", "+faststart"])
video("電影/ACME 年度回顧 (2025)/ACME 年度回顧 (2025).mp4", "plain", 4, ["-movflags", "+faststart"])
for ep in (1, 2, 3):
    video(f"影集/示範影集 S01/示範影集.S01E{ep:02d}.mkv",
          ["testsrc2", "smpte", "mandel"][ep - 1], 6)

# 內嵌字幕的範例：示範影片 乙 另外做一份含 SRT 字幕軌的版本
srt = path(".work/demo.srt")
if not os.path.exists(srt):
    with open(srt, "w", encoding="utf-8") as f:
        f.write("1\n00:00:00,500 --> 00:00:03,500\n這是示範字幕第一行。\n\n"
                "2\n00:00:04,000 --> 00:00:07,500\n字幕由內嵌軌即時轉成 WebVTT。\n")
ff("電影/字幕示範 (2022)/字幕示範 (2022).mkv",
   ["-f", "lavfi", "-i", SRC['testsrc2'],
    "-f", "lavfi", "-i", "sine=frequency=330", "-i", srt,
    "-map", "0", "-map", "1", "-map", "2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
    "-c:a", "aac", "-c:s", "srt", "-metadata:s:s:0", "language=chi", "-t", "8"])

# ---------------------------------------------------------------- 相片
PALETTES = [
    ((255, 183, 77), (229, 57, 53)), ((79, 195, 247), (21, 101, 192)),
    ((129, 199, 132), (27, 94, 32)), ((206, 147, 216), (106, 27, 154)),
    ((255, 241, 118), (245, 124, 0)), ((128, 222, 234), (0, 121, 107)),
    ((244, 143, 177), (173, 20, 87)), ((176, 190, 197), (55, 71, 79)),
]


def gradient(w, h, a, b, vertical=True):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    n = h if vertical else w
    for i in range(n):
        t = i / max(1, n - 1)
        c = tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))
        if vertical:
            d.line([(0, i), (w, i)], fill=c)
        else:
            d.line([(i, 0), (i, h)], fill=c)
    return im


def fake_photo(rel, seed, w, h, when):
    out = path(rel)
    if os.path.exists(out):
        return
    a, b = PALETTES[seed % len(PALETTES)]
    im = gradient(w, h, a, b, vertical=seed % 2 == 0)
    d = ImageDraw.Draw(im, "RGBA")
    # 幾何圖形：圓（太陽）、三角（山）、矩形（建築）
    r = min(w, h) // 7
    cx, cy = int(w * (0.2 + 0.6 * ((seed * 37) % 10) / 10)), int(h * 0.28)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 150))
    base = int(h * 0.78)
    for k in range(3):
        x0 = int(w * (k * 0.33 - 0.1))
        d.polygon([(x0, base), (x0 + int(w * 0.28), int(h * (0.42 + 0.06 * k))),
                   (x0 + int(w * 0.56), base)], fill=(0, 0, 0, 50 + 25 * k))
    d.rectangle([0, base, w, h], fill=(0, 0, 0, 70))
    exif = Image.Exif()
    exif[0x010F] = "ACME"            # Make
    exif[0x0110] = "Demo Cam 1"      # Model
    exif[0x0132] = when              # DateTime
    ifd = exif.get_ifd(0x8769)
    ifd[0x9003] = when               # DateTimeOriginal
    ifd[0x829D] = (28, 10)           # FNumber 2.8
    ifd[0x8827] = 100                # ISO
    ifd[0x920A] = (35, 1)            # FocalLength
    im.save(out, "JPEG", quality=88, exif=exif)
    print("相片", rel)


for i in range(1, 13):
    w, h = (1600, 1067) if i % 3 else (1067, 1600)
    fake_photo(f"相片/範例旅行/IMG_{i:04d}.jpg", i, w, h,
               f"2025:05:{i + 2:02d} 1{i % 10}:2{i % 6}:00")
for i in range(1, 7):
    fake_photo(f"相片/示範相簿/DSC_{i:04d}.jpg", i + 3, 1600, 1067,
               f"2024:11:{i + 10:02d} 09:1{i}:00")

# ---------------------------------------------------------------- PDF
def fake_pdf(rel, title, pages):
    out = path(rel)
    if os.path.exists(out):
        return
    big = ImageFont.truetype(FONT, 64)
    mid = ImageFont.truetype(FONT, 34)
    imgs = []
    for p in range(1, pages + 1):
        im = Image.new("RGB", (1240, 1754), "white")
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 1240, 180], fill=(25, 118, 210))
        d.text((90, 55), title, font=big, fill="white")
        d.text((90, 260), f"第 {p} 頁（示範文件，內容為虛構）", font=mid, fill=(40, 40, 40))
        for k in range(14):
            y = 360 + k * 80
            d.rectangle([90, y, 90 + 1060 - (k * 53) % 400, y + 26], fill=(220, 224, 230))
        imgs.append(im)
    imgs[0].save(out, "PDF", save_all=True, append_images=imgs[1:], resolution=150)
    print("PDF", rel)


fake_pdf("文件/範例手冊/範例手冊.pdf", "範例手冊", 4)
fake_pdf("文件/範例手冊/示範規格書.pdf", "示範規格書", 3)
fake_pdf("文件/ACME 說明/ACME 操作指南.pdf", "ACME 操作指南", 2)
print("完成：", ROOT)
