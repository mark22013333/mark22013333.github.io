// 用 VoiceType 真實的 Svelte 前端起 vite dev server，Tauri API 以 alias 換成 mock/tauri/*（不修改原始碼）。
// 用法：node serve.mjs <原始碼根目錄（含 src/App.svelte 與 src-tauri/）> [port，預設 8841]
//   或設定環境變數 VT_APP_DIR、VT_PORT。
// 截圖對應的版本：v0.8.5（與官網「下載」按鈕的 releases/latest 相同）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MOCK = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.argv[2] || process.env.VT_APP_DIR || "");
const PORT = Number(process.argv[3] || process.env.VT_PORT || 8841);
if (!fs.existsSync(path.join(APP, "src", "App.svelte"))) {
  console.error("找不到前端目錄（需含 src/App.svelte）：" + APP);
  process.exit(1);
}
const RS = (f) => fs.readFileSync(path.join(APP, "src-tauri", "src", f), "utf8");

// 從 Rust 原始碼抽出畫面要用的清單，讓模型、潤稿風格、Provider 的名稱與說明跟 App 一致。
const rustStr = (s) => JSON.parse('"' + s.replace(/\\\n\s*/g, "") + '"');
function consts(src) {
  const map = {};
  for (const m of src.matchAll(/const ([A-Z0-9_]+): &str = "((?:[^"\\]|\\.)*)";/g)) map[m[1]] = rustStr(m[2]);
  for (const m of src.matchAll(/const ([A-Z0-9_]+): &str = ([A-Z0-9_]+);/g)) map[m[1]] = map[m[2]];
  return map;
}
const field = (block, k, c) => {
  let m = block.match(new RegExp(k + ':\\s*"((?:[^"\\\\]|\\\\.)*)"'));
  if (m) return rustStr(m[1]);
  m = block.match(new RegExp(k + ":\\s*([A-Z0-9_]+)"));
  return m && c[m[1]] !== undefined ? c[m[1]] : "";
};

// 1. 模型清單（models.rs available_models）
const modelsRs = RS("models.rs");
const mc = consts(modelsRs);
const mbody = modelsRs.slice(modelsRs.indexOf("pub fn available_models"), modelsRs.indexOf("pub fn find_model"));
const models = mbody.split("ModelInfo {").slice(1).map((b) => ({
  id: field(b, "id", mc), name: field(b, "name", mc),
  size_mb: Number((b.match(/size_mb:\s*(\d+)/) || [])[1] || 0),
  engine: field(b, "engine", mc), quality: field(b, "quality", mc), speed: field(b, "speed", mc),
  description: field(b, "description", mc),
  recommended_ram_mb: Number((b.match(/recommended_ram_mb:\s*(\d+)/) || [])[1] || 0),
  recommended: /recommended:\s*true/.test(b),
}));

// 2. 內建潤稿風格（profile.rs builtin_styles）
const profileRs = RS("profile.rs");
const pc = consts(profileRs);
const sbody = profileRs.slice(profileRs.indexOf("pub fn builtin_styles"), profileRs.indexOf("pub const DEFAULT_STYLE_ID"));
const styles = [...sbody.matchAll(/PolishStyle \{ id: "([^"]+)"\.into\(\), name: "([^"]+)"\.into\(\), description: "([^"]*)"\.into\(\), prompt: (?:"((?:[^"\\]|\\.)*)"|([A-Z_]+))\.into\(\), builtin: true \}/g)]
  .map((m) => ({ id: m[1], name: m[2], description: m[3], prompt: m[4] !== undefined ? rustStr(m[4]) : pc[m[5]], builtin: true }));

// 3. LLM Provider（llm/registry.rs provider_info＋llm/secrets.rs 的 id）
const sc = consts(RS("llm/secrets.rs"));
const reg = RS("llm/registry.rs");
const tier = { Subscription: "subscription", FreeLimited: "free_limited", Local: "local" };
const providers = [...reg.matchAll(/id: (PROVIDER_[A-Z_]+),\s*display_name: "([^"]+)",\s*billing_label: "([^"]+)",\s*usage_tier: UsageTier::(\w+)/g)]
  .map((m) => ({ id: sc[m[1]], display_name: m[2], billing_label: m[3], usage_tier: tier[m[4]], has_api_key: false, key_preview: null }));

fs.writeFileSync(path.join(MOCK, "generated.json"), JSON.stringify({ models, styles, providers }, null, 2));
console.log(`抽出：模型 ${models.length}、潤稿風格 ${styles.length}、Provider ${providers.length}`);

// 4. 起 vite：沿用專案自己的 vite.config.js（svelte + tailwind），只覆寫 alias 與 port
const { createServer } = await import(pathToFileURL(path.join(APP, "node_modules", "vite", "dist", "node", "index.js")).href);
const T = (f) => path.join(MOCK, "tauri", f);
const server = await createServer({
  root: APP,
  configFile: path.join(APP, "vite.config.js"),
  resolve: {
    alias: [
      { find: "@tauri-apps/api/core", replacement: T("core.js") },
      { find: "@tauri-apps/api/event", replacement: T("event.js") },
      { find: "@tauri-apps/api/window", replacement: T("window.js") },
      { find: "@tauri-apps/plugin-store", replacement: T("store.js") },
      { find: "@tauri-apps/plugin-clipboard-manager", replacement: T("clipboard.js") },
      { find: "@tauri-apps/plugin-dialog", replacement: T("dialog.js") },
      { find: "@tauri-apps/plugin-notification", replacement: T("notification.js") },
    ],
  },
  server: { port: PORT, strictPort: true, host: "127.0.0.1", fs: { allow: [APP, MOCK] }, hmr: false },
  plugins: [{
    name: "voicetype-shot-backdrop",
    // App 視窗是透明的；截圖時在後面墊一層桌面底色，否則半透明面板會疊在白底上
    transformIndexHtml: (html) => html.replace("</head>", "<style>html,body{background:#e9ecf1!important}</style></head>"),
  }],
});
await server.listen();
console.log("vite ready http://127.0.0.1:" + PORT + "/  pid=" + process.pid);
