# README 截圖：機器清單、搜尋、新增表單、Tunnel 頁、Tunnel 編輯表單、關於頁。
# 在 repo 根目錄執行：vhs docs/tapes/sshm.tape
# 全程只用 docs/tapes/demo/ 的虛構資料與假 orca；不按 Enter 連線，不會觸發任何 ssh。
Output "site-shots/.out/sshm.gif"
Require go
Set Shell "bash"
Set FontFamily "Hack Nerd Font Mono"
Set FontSize 20
Set Width 1120
Set Height 900
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type ". docs/tapes/demo-env.sh && clear"
Enter
Sleep 12s
Type "sshm"
Enter
Sleep 2s

# (a) 機器清單：把「雲端主機」折疊起來，游標回到第一台
Down 8
Left
Sleep 300ms
Up 7
Sleep 500ms
Show
Sleep 500ms
Screenshot "site-shots/host-list.png"
Sleep 500ms

# (b) 輸入搜尋字過濾
Hide
Type "db"
Sleep 800ms
Show
Sleep 500ms
Screenshot "site-shots/search.png"
Sleep 500ms

# (c) 新增機器表單（只填名稱與 host 示意，按 Esc 取消、不存檔）
Hide
Escape
Sleep 300ms
Ctrl+N
Sleep 800ms
Type "acme-uat-web"
Sleep 300ms
Show
Sleep 500ms
Screenshot "site-shots/host-form.png"
Sleep 500ms

# (d) Tunnel 頁：假 orca 回報「ACME PROD DB」的 handle 存在 → ●，其餘 ○
Hide
Escape
Sleep 500ms
Tab
Sleep 2.5s
Show
Sleep 500ms
Screenshot "site-shots/tunnel-page.png"
Sleep 500ms

# (e) Tunnel 編輯表單（兩條規則的那一條），按 Esc 取消
Hide
Down 2
Sleep 300ms
Ctrl+E
Sleep 800ms
Show
Sleep 500ms
Screenshot "site-shots/tunnel-form.png"
Sleep 500ms

# (f) 關於頁：從 Tunnel 頁再按 Tab；版本與「已是最新版」來自 demo-env.sh 預寫的快取，不連 GitHub
Hide
Escape
Sleep 500ms
Tab
Sleep 1s
Show
Sleep 500ms
Screenshot "site-shots/about-page.png"
Sleep 500ms

Hide
Escape
Sleep 500ms
