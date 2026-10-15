// FamilyReward 截圖：只連本機 seed.py serve 起的服務（127.0.0.1:8811-8819），絕不連線上服務。
// 用法：node shoot.js <playwright 模組路徑> <輸出目錄> [base=http://127.0.0.1:8811] [only=名稱,名稱]
// 輸出寬 1200px（視窗 600 × deviceScaleFactor 2），每張只截一個區塊；首屏主圖用 1100 寬視窗。
const { chromium } = require(process.argv[2]);
const OUT = process.argv[3].replace(/\/?$/, '/');
const BASE = process.argv[4] || 'http://127.0.0.1:8811';
const ONLY = (process.argv[5] || '').split(',').filter(Boolean);
if (!/^http:\/\/127\.0\.0\.1:881\d$/.test(BASE)) throw new Error('只允許本機 8811-8819：' + BASE);
const EXE = process.env.PW_CHROMIUM || undefined;  // 未指定時用 playwright 自帶的 chromium
const W = 600;

async function childLogin(page, id, pin) {
  await page.goto(BASE + '/login/child/' + id, { waitUntil: 'networkidle' });
  await page.fill('#pin', pin);
  await Promise.all([
    page.waitForURL(u => u.pathname.startsWith('/child/'), { timeout: 15000 }),
    page.locator('form[data-pin-form] button[type=submit]').click(),
  ]);
  await page.waitForLoadState('networkidle');
}

async function adminLogin(page) {
  await page.goto(BASE + '/login/admin', { waitUntil: 'networkidle' });
  await page.fill('#username', 'demo-parent');
  await page.fill('#password', 'demo-parent-pw');
  await page.locator('form button[type=submit]').click();
  await page.waitForLoadState('networkidle');
}

const sec = t => `section:has(h2:has-text("${t}"))`;
const MING = [1, '1234'], MEI = [2, '5678'];

// [檔名, 角色, 路徑, 起點 selector（null＝頁首；'FULL'＝手機首屏）, 終點 selector（null＝同起點）]
// 選擇器可寫成 [selector, 第幾個]。
const H = 'main :is(h1,h2)';
const SHOTS = [
  // 首屏主圖：家長後台首頁，用寬視窗（頁面上主圖寬約 1054px）
  ['admin-dashboard', 'admin', '/admin/', null, sec('今天的小朋友'), null, 1100],
  ['child-today', MING, '/child/dashboard', null, sec('集點卡')],
  ['child-tasks', MING, '/child/dashboard', sec('今天的任務'), null],
  ['child-makeup', MING, '/child/dashboard', sec('前幾天還沒完成的'), null],
  ['child-calendar', MING, '/child/calendar', H, 'main'],
  ['child-rewards', MEI, '/child/rewards', H, ['main .card', 4]],
  ['child-certificate', MING, '/child/certificate', 'main', 'main', 760],
  ['admin-approvals', 'admin', '/admin/approvals', H, ['main .card', 1]],
  ['admin-redemptions', 'admin', '/admin/redemptions', H, ['main .card', 0]],
  ['admin-settings-card', 'admin', '/admin/settings', sec('集點卡'), null],
];

async function box(page, s) {
  const [sel, nth] = Array.isArray(s) ? s : [s, 0];
  const b = await page.locator(sel).nth(nth).boundingBox();
  if (!b) throw new Error('找不到區塊：' + sel);
  return b;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  for (const [name, who, path, start, end, maxH, vw] of SHOTS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const mobile = start === 'FULL';
    const ctx = await browser.newContext({
      viewport: { width: mobile ? 390 : (vw || W), height: mobile ? 844 : 900 }, deviceScaleFactor: 2,
      colorScheme: 'light', reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.route(u => !u.href.startsWith(BASE) && !u.href.startsWith('data:'), r => { console.log('外部請求（已攔）：', r.request().url()); r.abort(); });
    if (who === 'admin') await adminLogin(page);
    else if (who) await childLogin(page, who[0], who[1]);
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const file = OUT + name + '.png';
    if (mobile) {
      await page.screenshot({ path: file }); // 手機首屏（含底部分頁列）
    } else {
      // 視窗拉到整頁高，固定在底部的分頁列就不會蓋到中間內容。
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: vw || W, height: h });
      await page.waitForTimeout(300);
      const top = start ? (await box(page, start)).y : 0;
      const eb = await box(page, end || start);
      const pad = 16;
      const y = Math.max(0, top - pad);
      await page.screenshot({ path: file, clip: { x: 0, y, width: vw || W, height: Math.min(h, eb.y + eb.height + pad, maxH ? y + maxH : Infinity) - y } });
    }
    console.log('ok', name, page.url());
    await ctx.close();
  }
  await browser.close();
})();
