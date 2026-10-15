#!/bin/bash
# 起一套只用虛構素材的 FilmaxWeb 示範環境（截圖用）。
#
#   run_demo.sh <FilmaxWeb 原始碼目錄> <工作目錄> <python（已裝 requirements＋pyftpdlib）>
#
# - 工作目錄底下：ftp/（gen_media.py 產生的素材）、data/（全新的 SQLite 與快取）
# - FTP：pyftpdlib 只綁 127.0.0.1:8822，唯讀帳號 demo/demo
# - 網站：127.0.0.1:8821
# - env -i 清空環境：不帶任何 API key（TMDB、Google、MSSQL 全部是空的），
#   FILMAX_ENV_FILE 指到不存在的檔案，不讀原始碼目錄裡的 .env
# - 印出兩個 PID，收工時自行 kill
set -euo pipefail
SRC=$1; WORK=$2; PY=$3
mkdir -p "$WORK/data" "$WORK/home"

env -i PATH=/usr/bin:/bin HOME="$WORK/home" \
  "$PY" -c '
import sys, logging
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
logging.basicConfig(level=logging.WARNING)
a = DummyAuthorizer(); a.add_user("demo", "demo", sys.argv[1], perm="elr")
FTPHandler.authorizer = a
FTPHandler.encoding = "utf-8"
s = FTPServer(("127.0.0.1", 8822), FTPHandler); s.max_cons = 50
s.serve_forever()
' "$WORK/ftp" > "$WORK/ftp.log" 2>&1 &
echo "FTP_PID=$!"

env -i PATH=/opt/homebrew/bin:/usr/bin:/bin HOME="$WORK/home" LANG=en_US.UTF-8 \
  FILMAX_DATA_DIR="$WORK/data" FILMAX_ENV_FILE="$WORK/no-such.env" \
  FTP_HOST=127.0.0.1 FTP_PORT=8822 FTP_USER=demo FTP_PASSWORD=demo FTP_TLS=false \
  LIBRARY_ROOTS='/|auto' LIBRARY_LOCAL_ROOTS="/=$WORK/ftp" \
  TMDB_API_KEY= AUTH_ENABLED=false MSSQL_HOST= USER_STORE=sqlite \
  GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= \
  HOST=127.0.0.1 PORT=8821 DEV_RELOAD=false AUTO_SCAN_ON_START=false \
  FFMPEG_PATH=/opt/homebrew/bin/ffmpeg FFPROBE_PATH=/opt/homebrew/bin/ffprobe \
  FFMPEG_HWACCEL=none MIN_FILE_MB=0 MIN_PHOTO_KB=1 SCAN_EXCLUDE_DIR_PREFIXES=. \
  "$PY" "$SRC/run.py" > "$WORK/web.log" 2>&1 &
echo "WEB_PID=$!"
