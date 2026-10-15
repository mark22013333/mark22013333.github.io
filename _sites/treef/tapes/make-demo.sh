#!/bin/sh
# 建立 treef 截圖用的虛構展示專案「acme-shop」（全部是假資料）。
#
# 用法：sh make-demo.sh <新目錄>
#   目錄必須還不存在；腳本不刪除、不覆寫任何既有檔案。
#
# 產出：一個 git repo，含已追蹤（✔️）、已修改（✏️）、未追蹤（✨）三種狀態的檔案，
# 以及 B／KB／MB／GB 四種量級的檔案（GB 那個是稀疏檔，不實際佔用磁碟）。
# git 一律用 GIT_CONFIG_GLOBAL=/dev/null、GIT_CONFIG_NOSYSTEM=1，不讀使用者的 git 設定。
set -eu

DEMO=${1:?用法：sh make-demo.sh <新目錄>}
if [ -e "$DEMO" ]; then
  echo "目錄已存在，請換一個新路徑：$DEMO" >&2
  exit 1
fi

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=demo GIT_AUTHOR_EMAIL=demo@example.com
export GIT_COMMITTER_NAME=demo GIT_COMMITTER_EMAIL=demo@example.com
export GIT_AUTHOR_DATE="2026-09-01T10:00:00+08:00" GIT_COMMITTER_DATE="2026-09-01T10:00:00+08:00"

mkdir -p "$DEMO"
cd "$DEMO"
mkdir -p src/utils src/styles docs assets node_modules/lodash dist

printf 'node_modules/\ndist/\n' > .gitignore
printf '# ACME Shop\n\n示範用的虛構專案。\n' > README.md
printf '{\n  "name": "acme-shop",\n  "version": "1.0.0"\n}\n' > package.json
printf 'import { formatPrice } from "./utils/format.js";\nconsole.log(formatPrice(1200));\n' > src/app.js
printf 'export const formatPrice = (n) => `NT$ ${n}`;\n' > src/utils/format.js
printf 'body { margin: 0; }\n' > src/styles/main.css
printf '# 使用指南\n\n範例文件。\n' > docs/guide.md

# 指定大小的檔案（內容是 0，壓縮後很小）
head -c 348160 /dev/zero > assets/logo.png        # 340KB
head -c 2516582 /dev/zero > docs/manual.pdf       # 2MB（2.4MB 取整數）
head -c 1843200 /dev/zero > dist/bundle.js        # 1MB（被 .gitignore 忽略）
printf 'module.exports = {};\n' > node_modules/lodash/index.js

git init -q -b main .
git add .gitignore README.md package.json src docs/guide.md docs/manual.pdf assets/logo.png
git commit -q -m "init: 示範專案"

# 已修改（✏️）
printf 'console.log("ACME Shop 啟動");\n' >> src/app.js
# 未追蹤（✨）
printf 'test("formatPrice", () => {});\n' > src/utils/format.test.js
printf '# 變更紀錄\n' > docs/changelog.md
# GB 級的稀疏檔（未追蹤；git status 不會讀它的內容）
python3 -c 'import sys; f=open(sys.argv[1],"wb"); f.truncate(1288490188); f.close()' assets/promo-video.mp4

# 固定修改時間，讓 -t 的截圖每次重錄都一樣
find . -path ./.git -prune -o -exec touch -t 202609011030 {} +
touch -t 202610120915 src/app.js
touch -t 202610140840 src/utils/format.test.js docs/changelog.md

echo "展示專案已建立：$DEMO"
