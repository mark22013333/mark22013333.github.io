#!/bin/sh
# 重錄 treef 介紹頁的截圖（寬 1120、字級 20，放進約 590px 的欄位）。
#
# 用法：sh _sites/treef/tapes/record.sh <treef repo 的路徑> [暫存工作區的上層目錄]
#   需要：vhs、ttyd、ffmpeg、python3（Pillow）。
#   每次都在新的 mktemp 目錄建立虛構展示專案 acme-shop（make-demo.sh），不讀寫 ~/ 底下的設定；
#   裁空白邊後再用 pad_shots.py 把太窄的圖往右補底色到寬 760（首屏圖 1120），避免在頁面上被放大變糊。
#   暫存工作區不會自動刪除，路徑會印在最後。
set -eu

TREEF_REPO=${1:?用法：sh _sites/treef/tapes/record.sh <treef repo 的路徑> [暫存工作區的上層目錄]}
PARENT=${2:-${TMPDIR:-/tmp}}
HERE=$(cd "$(dirname "$0")" && pwd -P)
PORTAL=$(cd "$HERE/../../.." && pwd -P)
IMG="$PORTAL/_sites/treef/img"
TREEF_REPO=$(cd "$TREEF_REPO" && pwd -P)

WORK=$(mktemp -d "$PARENT/treef-shots.XXXXXX")
mkdir -p "$WORK/bin" "$WORK/shots/.out"
ln -s "$TREEF_REPO/treef.sh" "$WORK/bin/treef"
sh "$HERE/make-demo.sh" "$WORK/acme-shop"

export TREEF_DEMO="$WORK/acme-shop" TREEF_BIN="$WORK/bin" TREEF_TAPES="$HERE"
(cd "$WORK" && vhs "$HERE/treef.tape")

for name in hero time filter dirs-only export; do
  if [ ! -s "$WORK/shots/$name.png" ]; then
    echo "缺少截圖：$WORK/shots/$name.png" >&2
    exit 1
  fi
  cp "$WORK/shots/$name.png" "$IMG/$name.png"
done
python3 "$PORTAL/tools/trim_shots.py" "$IMG/hero.png" "$IMG/time.png" "$IMG/filter.png" "$IMG/dirs-only.png" "$IMG/export.png"
python3 "$HERE/pad_shots.py" --min-width 1120 "$IMG/hero.png"
python3 "$HERE/pad_shots.py" "$IMG/time.png" "$IMG/filter.png" "$IMG/dirs-only.png" "$IMG/export.png"
echo "完成（暫存工作區：${WORK}）。接著執行：python3 $PORTAL/tools/build_sites.py treef"
