// 對 serve.mjs 起的真實前端截圖（headless chromium、deviceScaleFactor 2）。
// 用法：node shoot.cjs <playwright 模組路徑> <chromium 執行檔> <輸出目錄> [port]
// 截完再跑 python3 tools/trim_shots.py 裁掉下方空白底色。
const { chromium } = require(process.argv[2]);
const EXE = process.argv[3];
const OUT = process.argv[4].replace(/\/?$/, "/");
const BASE = "http://127.0.0.1:" + (process.argv[5] || 8841) + "/";

async function open(browser, w, h, query) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, timezoneId: "Asia/Taipei" });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("console", (m) => { if (m.type() === "error") page.errs.push(m.text()); });
  page.on("pageerror", (e) => page.errs.push("pageerror: " + e.message));
  // 除了本機 dev server，只放行 App 自己 index.html 引用的 Google Fonts，其餘外部連線一律擋掉
  const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
  await ctx.route((url) => !url.href.startsWith(BASE) && !FONT_HOSTS.includes(url.hostname), (r) => r.abort());
  await page.goto(BASE + query, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  return { ctx, page };
}

const emit = (page, name, payload) => page.evaluate(([n, p]) => window.__vtEmit(n, p), [name, payload]);
const unknown = (page) => page.evaluate(() => [...window.__vtUnknown]);

// 捲動設定頁內容區，讓指定標題的區塊貼齊上緣
async function scrollToLabel(page, text) {
  await page.evaluate((a) => {
    const label = [...document.querySelectorAll(".content-body *")].find((el) => el.children.length === 0 && el.textContent.trim() === a);
    if (!label) throw new Error("找不到區塊：" + a);
    const body = label.closest(".content-body");
    const sec = label.closest(".section") || label;
    body.scrollTop += sec.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
  }, text);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const log = [];

  // 1. 會議／離線錄音：REC → 錄音中 → STOP → 後端自動 AI 潤稿（會議紀錄風格）→ 自動貼上
  {
    // 工具列寬度可由使用者拖曳調整（480–760），這裡用上限 760，讓錄音中的辨識文字有空間顯示
    const { ctx, page } = await open(browser, 760, 456, "?scene=meeting");
    await page.getByRole("button", { name: "REC", exact: true }).click();
    await page.getByRole("button", { name: "STOP", exact: true }).waitFor();
    const { SEGMENTS, RECORDING_SECS } = await page.evaluate(() => window.__vtData);
    await emit(page, "recording-time", RECORDING_SECS);
    await emit(page, "audio-levels", { mic: 0.55, sys: null });
    for (const s of SEGMENTS) await emit(page, "asr-segment", s);
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + "recording.png", clip: { x: 0, y: 0, width: 760, height: 56 } });
    await page.getByRole("button", { name: "STOP", exact: true }).click();
    await page.getByText("AI 整理結果").waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + "meeting.png" });
    // 展開面板捲到底，看完整的 AI 整理結果
    await page.evaluate(() => { const p = document.querySelector(".expand-panel"); p.scrollTop = p.scrollHeight; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + "meeting-result.png" });
    log.push(["meeting", page.errs, await unknown(page)]);
    await ctx.close();
  }

  // 2. TYPE 模式：貼上口語文字 → 潤稿（簡短訊息風格）
  {
    const { ctx, page } = await open(browser, 600, 456, "?scene=type");
    await page.getByRole("button", { name: "TYPE", exact: true }).click();
    const input = await page.evaluate(() => window.__vtData.TYPE_INPUT);
    await page.locator("textarea").fill(input);
    await page.getByRole("button", { name: "潤稿", exact: true }).click();
    await page.getByText("潤稿結果").waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + "type-mode.png" });
    log.push(["type", page.errs, await unknown(page)]);
    await ctx.close();
  }

  // 3. 設定視窗（原生視窗 680×560，這裡加高以容納較多內容）
  // [分頁, 檔名, 視窗高度, 捲動到哪個區塊標題（null＝不捲）, 只截內容區的高度（null＝整個視窗）]
  for (const [tab, file, h, anchor, clip] of [
    ["一般", "settings-general.png", 760, "AI 潤稿模型"],
    ["錄音", "settings-recording.png", 700, "日常即時聽寫", 420],
    ["模型管理", "settings-models.png", 900, null],
    ["潤稿風格", "settings-styles.png", 800, null],
  ]) {
    const { ctx, page } = await open(browser, 680, h, "?window=settings&scene=settings");
    await page.locator(".nav-item", { hasText: tab }).first().click();
    await page.waitForTimeout(800);
    if (anchor) await scrollToLabel(page, anchor);
    if (clip) {
      // 只截右側內容區（頁面窄欄也讀得清楚）
      const box = await page.locator(".content").first().boundingBox();
      await page.screenshot({ path: OUT + file, clip: { x: box.x, y: box.y, width: box.width, height: clip } });
    } else {
      await page.screenshot({ path: OUT + file });
    }
    log.push([tab, page.errs, await unknown(page)]);
    await ctx.close();
  }

  await browser.close();
  for (const [n, e, u] of log) console.log(n, "console errors=" + e.length, e.join(" | "), "未模擬的指令=" + (u.join(",") || "無"));
})();
