#!/bin/sh
# 重錄 sshm 介紹頁的截圖（官網專用：寬 1120、字級 20，放進約 590px 的欄位後字約 10～11px；再窄「關於」頁的路徑會折行）。
#
# 用法：sh _sites/sshm/tapes/record.sh <sshm repo 的路徑>
#   需要：vhs、ttyd、ffmpeg、Go；sshm repo 要有 tag（git describe 取版本號，淺 clone 請先 fetch --tags）
#
# tape 沿用 sshm repo 的 docs/tapes/*.tape，只改尺寸與輸出路徑；動作步驟不變。
# 錄製在 sshm repo 的 docs/tapes/demo-env.sh 建立的暫存 HOME 中進行，不會讀寫 ~/.config/sshm 與 ~/.ssh。
# 錄完把截圖裁掉空白邊後放進 _sites/sshm/img/，再執行 python3 tools/build_sites.py。
set -eu

SSHM_REPO=${1:?用法：sh _sites/sshm/tapes/record.sh <sshm repo 的路徑>}
HERE=$(cd "$(dirname "$0")" && pwd -P)
PORTAL=$(cd "$HERE/../../.." && pwd -P)
IMG="$PORTAL/_sites/sshm/img"
SHOTS="$SSHM_REPO/site-shots"

mkdir -p "$SHOTS/.out"
for tape in sshm import-iterm; do
  (cd "$SSHM_REPO" && vhs "$HERE/$tape.tape")
done

for name in host-list search host-form tunnel-page about-page import-iterm; do
  if [ ! -s "$SHOTS/$name.png" ]; then
    echo "缺少截圖：$SHOTS/$name.png" >&2
    exit 1
  fi
  cp "$SHOTS/$name.png" "$IMG/$name.png"
done
python3 "$PORTAL/tools/trim_shots.py" \
  "$IMG/host-list.png" "$IMG/search.png" "$IMG/host-form.png" \
  "$IMG/tunnel-page.png" "$IMG/about-page.png" "$IMG/import-iterm.png"
echo "完成。接著執行：python3 $PORTAL/tools/build_sites.py"
