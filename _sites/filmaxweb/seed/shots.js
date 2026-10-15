// 對 run_demo.sh 起的示範站（127.0.0.1:8821）拍截圖。
//   node shots.js <playwright 模組路徑> <輸出目錄> [只拍哪幾張，逗號分隔]
// 用系統的 Google Chrome（獨立的暫存設定檔，不碰使用者的 Chrome 設定）：
// chrome-headless-shell 沒有 H.264 解碼器，播放器畫面會是黑的。
const { chromium } = require(process.argv[2]);
const OUT = process.argv[3].replace(/\/?$/, '/');
const ONLY = (process.argv[4] || '').split(',').filter(Boolean);
const BASE = 'http://127.0.0.1:8821';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(browser, name, w, h, fn) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2,
                                         colorScheme: 'dark', locale: 'zh-TW' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await fn(page);
    await page.screenshot({ path: OUT + name + '.png' });
    console.log('ok', name, errs.length ? 'errors=' + errs.join(' | ') : '');
  } catch (e) {
    console.log('FAIL', name, e.message);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
                                          args: ['--autoplay-policy=no-user-gesture-required'] });

  // 首頁海報牆
  await shot(browser, 'library', 600, 530, async p => {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await sleep(800);
  });

  // 條目詳細（影集）
  await shot(browser, 'item', 600, 620, async p => {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => window.openItem(6));
    await sleep(1200);
  });

  // 播放器：字幕示範（mkv＋內嵌字幕 → HLS）
  await shot(browser, 'player', 600, 400, async p => {
    const files = await (await p.request.get(BASE + '/api/items/2')).json();
    const fid = (files.files || [])[0].id;
    await p.goto(BASE + '/player?file=' + fid, { waitUntil: 'domcontentloaded' });
    // 播到第 5 秒（第二句字幕出現的時段）暫停，讓控制列與字幕都留在畫面上
    await p.waitForFunction(() => { const v = document.querySelector('video');
      return v && v.currentTime >= 5; }, null, { timeout: 30000 });
    await p.evaluate(() => document.querySelector('video').pause());
    await p.mouse.move(300, 200);
    await sleep(800);
  });

  // 相片牆
  await shot(browser, 'photos', 600, 640, async p => {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.click('nav button[data-media="photo"]');
    await sleep(1800);
  });

  // 相片燈箱＋EXIF 側欄
  await shot(browser, 'photo-view', 600, 640, async p => {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.click('nav button[data-media="photo"]');
    await sleep(1500);
    await p.locator('#pgrid > *').nth(1).click();
    await sleep(1800);
    // 側欄捲到底，讓「拍攝資訊」（相機、拍攝時間）出現在畫面上
    await p.evaluate(() => { const el = document.querySelector('.pswp__info');
      if (el) el.scrollTop = el.scrollHeight; });
    await sleep(400);
  });

  // PDF 閱讀器
  await shot(browser, 'reader', 600, 520, async p => {
    const d = await (await p.request.get(BASE + '/api/documents')).json();
    const id = (d.items || d.documents || d)[0].id;
    await p.goto(BASE + '/reader?doc=' + id, { waitUntil: 'networkidle' });
    await sleep(2500);
  });

  // 後台
  await shot(browser, 'admin', 600, 560, async p => {
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelector('[data-tab=params]').click());
    await sleep(1500);
    // 用頁面上的搜尋框篩出畫質相關的參數
    await p.locator('#tab-params input[type=search], #tab-params input').first().fill('畫質');
    await sleep(800);
  });

  await browser.close();
})();
