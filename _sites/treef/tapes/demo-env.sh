# 由 treef.tape 在錄影的 shell 裡 source：切到展示專案、把 treef 放進 PATH。
# 需要 record.sh 先 export TREEF_DEMO（展示專案路徑）與 TREEF_BIN（放 treef 的目錄）。
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export PATH="$TREEF_BIN:$PATH"
export PS1='\[\e[38;5;114m\]acme-shop\[\e[0m\] $ '
cd "$TREEF_DEMO"
