# treef 介紹頁截圖。由 record.sh 呼叫（工作目錄＝本次的暫存工作區）。
# 全程只在 make-demo.sh 建立的虛構專案 acme-shop 裡執行 treef。
Output "shots/.out/treef.gif"
Set Shell "bash"
Set FontFamily "Hack Nerd Font Mono"
Set FontSize 20
Set Width 1120
Set Height 900
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 20ms

Hide
Type ". $TREEF_TAPES/demo-env.sh && clear"
Enter
Sleep 1s

# (a) 首屏：README「日常開發」範例，Git 狀態＋檔案大小，排除 node_modules 與 dist
Type "treef . -g -h -e node_modules,dist"
Enter
Sleep 3s
Show
Sleep 300ms
Screenshot "shots/hero.png"
Sleep 300ms

# (b) 修改時間＋大小
Hide
Type "clear"
Enter
Type "treef src -t -h"
Enter
Sleep 2s
Show
Sleep 300ms
Screenshot "shots/time.png"
Sleep 300ms

# (c) 包含＋排除過濾（-e 用名稱；萬用字元會先被 shell 依目前目錄展開，見介紹頁報告）
Hide
Type "clear"
Enter
Type 'treef . "src*" docs -e utils,manual.pdf'
Enter
Sleep 2s
Show
Sleep 300ms
Screenshot "shots/filter.png"
Sleep 300ms

# (d) 只看目錄
Hide
Type "clear"
Enter
Type "treef -do"
Enter
Sleep 2s
Show
Sleep 300ms
Screenshot "shots/dirs-only.png"
Sleep 300ms

# (e) 導向檔案：自動拿掉顏色代碼（這一步會在展示專案裡留下 structure.txt，所以放最後）
Hide
Type "clear"
Enter
Type "treef . -do -e node_modules,dist > structure.txt"
Enter
Type "cat structure.txt"
Enter
Sleep 2s
Show
Sleep 300ms
Screenshot "shots/export.png"
Sleep 300ms
