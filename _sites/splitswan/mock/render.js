// 把 mock/*.html 截成 img/*.png（deviceScaleFactor 2，只截 #shot 元素）。
// 用法：node render.js <playwright 模組路徑> <chromium 執行檔路徑>
// 例：node _sites/splitswan/mock/render.js \
//       "$PW_MODULE" \
//       ~/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell
const path = require('path');
const { chromium } = require(process.argv[2]);
const exe = process.argv[3];
const MOCK = __dirname;
const IMG = path.join(__dirname, '..', 'img');
const PAGES = (process.argv[4] || 'menu,connection,host-check,environment').split(',');

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  for (const name of PAGES) {
    await page.goto('file://' + path.join(MOCK, name + '.html'));
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(IMG, name + '.png');
    await page.locator('#shot').screenshot({ path: out, omitBackground: false });
    const box = await page.locator('#shot').boundingBox();
    console.log(name, Math.round(box.width * 2) + 'x' + Math.round(box.height * 2), out);
  }
  await browser.close();
})();
