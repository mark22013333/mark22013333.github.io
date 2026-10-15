#!/bin/sh
# 用全新的空 SQLite＋新產生的加密金鑰啟動 ChatPulse 儀表板後端，供截圖用。
#
# 用法：sh serve.sh <ChatPulse repo> <venv 的 python> <工作根目錄> <port>
#   會在 <工作根目錄>/run-<時間戳>/ 建立全新的 data，寫入 fixture.json 的虛構資料，
#   然後在背景啟動 uvicorn（只聽 127.0.0.1），把 PID 寫到該目錄的 server.pid、
#   session token 寫到 session.txt，最後一行印出該目錄路徑。
#
# 不連外部服務的保證：
#   - credentials 表不寫入任何 Google 憑證 → 採集器跳過這位 Viewer，Space／訊息端點回 401
#   - env -u 掉 GOOGLE_API_KEY 等金鑰；CHATPULSE_CLAUDE_BIN 指向一支只會失敗的假指令
#   - CHATPULSE_CODE=0、CHATPULSE_IMAGES=0；HOME 改到工作目錄
#   - client secret 指到工作目錄裡不存在的檔案；ZPLANNER_* 清空
set -eu

REPO=$(cd "${1:?缺 ChatPulse repo 路徑}" && pwd -P)
PY=${2:?缺 venv python}
ROOT=${3:?缺工作根目錄}
PORT=${4:?缺 port}
HERE=$(cd "$(dirname "$0")" && pwd -P)

RUN="$ROOT/run-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN/data" "$RUN/home" "$RUN/bin"
if [ -d "$REPO/data" ] || [ -d "$REPO/config" ]; then
  echo "中止：$REPO 底下有 data/ 或 config/，可能是正在使用的 repo，請改用乾淨的 clone" >&2
  exit 1
fi

# 假的 claude 指令：讓「供應商可用」的檢查通過，但真的被呼叫時只會失敗
cat > "$RUN/bin/claude" <<'SH'
#!/bin/sh
echo "截圖環境：不呼叫任何 AI" >&2
exit 1
SH
chmod +x "$RUN/bin/claude"

set -- env -u GOOGLE_API_KEY -u GEMINI_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
  -u GOOGLE_APPLICATION_CREDENTIALS -u ZPLANNER_APIKEY -u ZPLANNER_BASE_URL \
  -u CHATPULSE_AI_PROVIDER -u CHATPULSE_BOOTSTRAP_USER_ID -u CHATPULSE_BOOTSTRAP_EMAIL \
  HOME="$RUN/home" \
  CHATPULSE_DATA_DIR="$RUN/data" \
  CHATPULSE_DB="$RUN/data/chatpulse.db" \
  CHATPULSE_KEY_FILE="$RUN/data/token.key" \
  CHATPULSE_CLIENT_SECRET="$RUN/data/no-client-secret.json" \
  CHATPULSE_CLAUDE_BIN="$RUN/bin/claude" \
  CHATPULSE_CODE=0 CHATPULSE_IMAGES=0 \
  CHATPULSE_POLL_INTERVAL=3600

"$@" "$PY" "$HERE/seed.py" "$REPO" "$HERE/fixture.json" "$RUN" >&2

"$@" "$PY" -m uvicorn dashboard.api.server:app --app-dir "$REPO" \
  --host 127.0.0.1 --port "$PORT" > "$RUN/server.log" 2>&1 &
echo $! > "$RUN/server.pid"

i=0
until curl -fsS "http://127.0.0.1:$PORT/api/v1/health" > /dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "伺服器 20 秒內沒有起來，log：$RUN/server.log" >&2
    exit 1
  fi
  sleep 0.5
done
echo "$RUN"
