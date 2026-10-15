/**
 * 截 ChatPulse 介紹頁用的畫面。
 *
 *   node shoot.cjs <playwright 模組路徑> <chromium 執行檔> <serve.sh 印出的 RUN 目錄> <port> <輸出目錄> [explore]
 *
 * 後端是 serve.sh 起的真實 ChatPulse（全新 SQLite＋fixture 的虛構資料）。
 * 只有三個端點在瀏覽器這一側用 fixture 回應，因為它們在正式程式裡**一律即時向 Google Chat 取**、
 * 資料庫裡本來就沒有（Mention 的訊息內容刻意不落地）：
 *   GET /api/v1/spaces    → fixture.spaces（lastSummaryAt 取自真實後端的 /summaries）
 *   GET /api/v1/messages  → fixture.messages
 *   GET /api/v1/mentions  → 真實後端以 with_content=false 回的列，再補上 fixture 的訊息文字
 * 其餘請求原樣送到真實後端；任何不是 127.0.0.1:<port> 的請求一律擋掉。
 */
const fs = require('fs')
const path = require('path')
const [, , PW, EXE, RUN, PORT, OUT, MODE] = process.argv
const { chromium } = require(PW)
const BASE = `http://127.0.0.1:${PORT}`
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'))
const TOKEN = fs.readFileSync(path.join(RUN, 'session.txt'), 'utf8').trim()
const NOW = Date.now()
const iso = (msAgo) => new Date(NOW - msAgo).toISOString()

function hhmm(minutesAgo) {
  // 與後端 get_messages 相同：createTime 前 16 碼、T 換成空白（UTC）
  return iso(minutesAgo * 60_000).slice(0, 16).replace('T', ' ')
}

async function backend(pathname) {
  const r = await fetch(BASE + pathname, { headers: { cookie: `chatpulse_session=${TOKEN}` } })
  return r.json()
}

async function install(ctx) {
  await ctx.addCookies([{ name: 'chatpulse_session', value: TOKEN, domain: '127.0.0.1', path: '/' }])
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.host !== `127.0.0.1:${PORT}`) return route.abort()
    const p = url.pathname
    const json = (body) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (req.method() === 'GET' && p === '/api/v1/spaces') {
      const sums = (await backend('/api/v1/summaries')).summaries || []
      const last = {}
      for (const s of sums) if (!last[s.space_id] || last[s.space_id] < s.created_at) last[s.space_id] = s.created_at
      const spaces = FX.spaces.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        type: s.type,
        threadingState: s.type === 'DIRECT_MESSAGE' ? null : 'THREADED_MESSAGES',
        lastActiveTime: iso(s.active_hours_ago * 3600_000),
        memberCount: s.members,
        renamable: !!s.renamable,
        nameSource: s.nameSource || null,
        pinned: false,
        lastSummaryAt: last[s.id] || null,
      }))
      return json({ count: spaces.length, total: spaces.length, cached: false, cached_at: iso(0), spaces })
    }
    if (req.method() === 'GET' && p === '/api/v1/messages') {
      const sid = url.searchParams.get('space_id')
      const msgs = (FX.messages[sid] || []).map((m, i) => ({
        name: `${sid}/messages/x${i}`,
        sender: m.sender,
        sender_id: m.sender_id,
        time: hhmm(m.minutes_ago),
        text: m.text,
        attachment_note: '',
        thread_name: `${sid}/threads/${m.thread}`,
      }))
      const sp = FX.spaces.find((s) => s.id === sid)
      return json({ space_id: sid, space_name: sp ? sp.displayName : sid, thread_name: null, count: msgs.length, messages: msgs })
    }
    if (req.method() === 'GET' && p === '/api/v1/mentions') {
      url.searchParams.set('with_content', 'false')
      const real = await backend(p + '?' + url.searchParams.toString())
      const text = {}
      for (const m of FX.mentions) text[`${m.space_id}/messages/${m.key}`] = m.text
      real.mentions = (real.mentions || []).map((m) => ({ ...m, text: text[m.message_name] ?? null }))
      return json(real)
    }
    return route.continue()
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: EXE })
  const log = []
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: Number(process.env.VW || 1280), height: Number(process.env.VH || 800) },
      deviceScaleFactor: 2,
      colorScheme: theme,
    })
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('theme', t) } catch {}
    }, theme)
    await install(ctx)
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()) })
    page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()) })

    const go = async (hash, wait = 1500) => {
      await page.goto(BASE + '/' + hash, { waitUntil: 'load' })
      await page.waitForTimeout(wait)
    }
    const snap = async (name) => {
      const f = path.join(OUT, `${name}-${theme}.png`)
      await page.screenshot({ path: f })
      log.push(f)
    }

    if (MODE === 'explore') {
      for (const [hash, name] of [
        ['#/summary', 'summary'],
        ['#/summary/DEMO0002', 'summary-space'],
        ['#/mentions', 'mentions'],
        ['#/mentions/1', 'mention-1'],
        ['#/settings/reply', 'settings-reply'],
        ['#/spaces', 'spaces'],
      ]) {
        await go(hash)
        await snap(name)
      }
    }
    if (MODE === 'explore2') {
      await page.setViewportSize({ width: 1280, height: 800 })
      await go('#/summary/DEMO0002')
      await page.getByRole('button', { name: /範例專案群組/ }).last().click()
      await page.waitForTimeout(800)
      await snap('hist')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      await go('#/mentions/1', 2000)
      const c = page.getByRole('button', { name: '收合設定' })
      if (await c.count()) { await c.first().click(); await page.waitForTimeout(600) }
      await snap('draft')
    }
    if (MODE === 'final' && theme === 'light') {
      // 每張圖開一個新分頁、先設好寬度再載入，避免 hash 換頁沿用上一個版面狀態
      const shot = async (name, hash, vw, vh, sel, prep) => {
        const pg = await ctx.newPage()
        pg.on('pageerror', (e) => errors.push('pageerror ' + e.message))
        pg.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()) })
        await pg.setViewportSize({ width: vw, height: vh })
        await pg.goto(BASE + '/' + hash, { waitUntil: 'load' })
        await pg.waitForTimeout(1800)
        if (prep) await prep(pg)
        const f = path.join(OUT, `${name}.png`)
        if (typeof sel === 'function') await pg.screenshot({ path: f, clip: await sel(pg) })
        else await pg.locator(sel).first().screenshot({ path: f })
        log.push(f)
        await pg.close()
      }
      // Space 清單：截到表格底部為止
      await shot('spaces', '#/summary', 1100, 680, async (pg) => {
        const main = await pg.locator('#main').first().boundingBox()
        // 表格是 div 排的，以下方分頁列（「每頁 N 筆」）的頂邊為界
        const pager = await pg.getByText(/每頁 \d+ 筆/).first().boundingBox()
        return { x: main.x, y: main.y, width: main.width, height: pager.y - 14 - main.y }
      })
      await shot('summary', '#/summary/DEMO0002', 1280, 800, '[role="dialog"]', async (pg) => {
        await pg.locator('[aria-label="證據"]').getByRole('button', { name: /範例專案群組/ }).first().click()
        await pg.waitForTimeout(800)
      })
      // 收件匣：清單＋明細兩欄（左側導覽與頂列不入鏡）
      await shot('inbox', '#/mentions/2', 1100, 640, async (pg) => {
        const nav = await pg.locator('nav[aria-label="主導覽"]').first().boundingBox()
        const main = await pg.locator('#main').first().boundingBox()
        const x = nav.x + nav.width
        return { x, y: main.y, width: 1100 - x, height: 640 - main.y }
      })
      // 草稿：只截到「建議回話」卡片之前。讀回已存草稿時，前端把整份 content_md
      // （含脈絡分析）放進回話編輯框（store/draft.ts:429）。2026-10-15 用現行格式
      // （generation_config 含 meta）實測仍然如此，與新舊格式無關，所以不讓那一格入鏡。
      await shot('draft', '#/mentions/1', 1440, 900, async (pg) => {
        const c = pg.getByRole('button', { name: '收合設定' })
        if (await c.count()) { await c.first().click(); await pg.waitForTimeout(600) }
        const main = await pg.locator('#main').first().boundingBox()
        const send = await pg.getByRole('button', { name: /送出回話/ }).first().boundingBox()
        return { x: main.x, y: main.y, width: main.width, height: send.y - main.y - 22 }
      })
      // 回覆預設值：截到 Sepia 卡片底部
      await shot('reply-settings', '#/settings/reply', 1100, 760, async (pg) => {
        const main = await pg.locator('#main').first().boundingBox()
        const sep = await pg.getByText('只調整〈建議回話〉', { exact: false }).first().boundingBox()
        return { x: main.x, y: main.y, width: main.width, height: sep.y + sep.height + 30 - main.y }
      })
    }
    log.push(`${theme} errors: ${errors.length ? errors.join(' | ') : 0}`)
    await ctx.close()
  }
  await browser.close()
  console.log(log.join('\n'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
