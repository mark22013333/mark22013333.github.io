// 重繪 crew 介紹頁的示意圖：把 mock/*.html 的 #shot 元素截成 ../img/*.png。
// 用法：node render.js [playwright 模組路徑] [chromium 執行檔路徑]
//   兩個參數也可改用環境變數 PW_MODULE、PW_CHROMIUM 指定；都沒給時 chromium 用 playwright 自帶的版本。
// 終端機類（.term）用 deviceScaleFactor 1（CSS 已是 1120 寬、字級 20）；
// 終端機三張產生後再跑 python3 tools/trim_shots.py _sites/crew/img/{intake-confirm,plan-start-done,resume}.png 裁右下空白。
// Notion（.notion）CSS 寬 560，用 deviceScaleFactor 2 輸出 1120 寬；流程圖（.flow）CSS 寬 640，用 1.75 輸出 1120 寬。
const path = require('path');
const PW = process.argv[2] || process.env.PW_MODULE || 'playwright';
const EXE = process.argv[3] || process.env.PW_CHROMIUM || undefined;
const { chromium } = require(PW);

const DIR = __dirname;
const OUT = path.join(DIR, '..', 'img');
const SHOTS = [
  ['lifecycle', 1.75],
  ['intake-confirm', 1],
  ['plan-start-done', 1],
  ['notion-feature', 2],
  ['resume', 1],
  ['notion-bug', 2],
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  for (const [name, scale] of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(DIR, name + '.html'));
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, name + '.png');
    await page.locator('#shot').screenshot({ path: out });
    console.log('寫入', out);
    await ctx.close();
  }
  await browser.close();
})();
