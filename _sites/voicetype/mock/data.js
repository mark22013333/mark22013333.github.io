// VoiceType 截圖用的虛構展示資料。人名、會議內容全部是虛構的。
// 情境由網址參數 scene 決定：meeting（錄音→會議紀錄風格）、type（TYPE 模式→簡短訊息風格）、settings。
// 模型、潤稿風格、Provider 清單由 serve.mjs 從原始碼抽出（generated.json），不是手寫。
import GEN from "./generated.json";

export const scene = new URLSearchParams(location.search).get("scene") || "meeting";
export const { models: MODELS, styles: STYLES, providers: PROVIDERS } = GEN;

export const CURRENT_STYLE = scene === "type" ? "short-message" : scene === "meeting" ? "meeting-notes" : "daily-typing";

export const STORE = {
  fontSize: 14,
  hotkey: "Cmd+Shift+O",
  claudeCliPath: "/usr/local/bin/claude",
  activeWhisperModel: "breeze-asr-25",
  denoiseEnabled: true,
  micEnabled: true,
  waveformStyle: "bars",
  // 「停止會議或離線錄音後自動 AI 潤稿」預設關閉（後端 state.rs），這裡模擬使用者已在「設定 → 錄音」開啟；
  // 門檻維持預設 60 秒，所以示範錄音做成 72 秒。
  aiPolishEnabled: true,
  polishSkipUnderSecs: 60,
};

export const INSTALLED = ["breeze-asr-25"];

export const DEVICES = [
  { id: "builtin", name: "內建麥克風", is_default: true },
  { id: "usb", name: "USB 麥克風", is_default: false },
];

// 一場 72 秒的虛構會議錄音（會議／離線錄音模式）。created_at_ms 是後端 Segment 的絕對時間欄位。
const T0 = Date.UTC(2026, 7, 4, 2, 0, 0); // 2026-08-04 10:00:00（台北時間）
export const RECORDING_SECS = 72;
export const SEGMENTS = [
  [0, "好，那我們開始，今天主要確認下週二的版本發布。"],
  [18, "嗯那個測試環境目前還有兩個 bug 沒修完，小明說週四前可以處理好。"],
  [37, "然後文件的部分，安裝說明要補 Windows 的截圖。"],
  [55, "發布前一天下午我們再開一次會，確認沒問題就上線。"],
].map(([t, text], index) => ({ index, timestamp_secs: t, created_at_ms: T0 + t * 1000, text }));

// 「會議紀錄」風格的 prompt 要求：保留重點、適當分段加標題、整理決議與待辦（見原始碼 profile.rs 的會議紀錄 prompt）
export const MEETING_RESULT = `版本發布確認會議

發布準備
- 下週二發布新版本。
- 發布前一天下午再開一次確認會議，確認沒問題即上線。

待處理事項
- 測試環境還有兩個 bug 未修復，由小明於週四前處理完成。
- 安裝說明需補上 Windows 的截圖。`;

// 「簡短訊息」風格：簡短、清楚、自然的即時訊息，忠實保留原意
export const TYPE_INPUT = "欸那個明天的讀書會改到下午三點喔，然後地點一樣在三樓會議室，嗯大家記得帶筆電，就這樣";
export const TYPE_RESULT = "明天的讀書會改到下午三點，地點一樣在三樓會議室，記得帶筆電。";

// 讓截圖腳本拿到同一份展示資料
window.__vtData = { SEGMENTS, TYPE_INPUT, RECORDING_SECS };
