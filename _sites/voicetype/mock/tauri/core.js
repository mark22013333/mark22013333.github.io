// 取代 @tauri-apps/api/core：invoke 一律回傳虛構資料，不呼叫任何原生功能、不錄音、不連外。
// 回傳形狀照後端 Rust 指令的型別；沒列出的指令回傳 undefined 並記在 window.__vtUnknown 供除錯。
// 錄音流程照後端 pipeline 的事件順序模擬（會議／離線錄音模式）：
//   開始：recognition-mode-changed → status-changed "Recording"
//   停止：status-changed "Transcribing" → finalize-progress → "Processing" → inject-done → "Done" → result-ready
//   手動整理："Processing" → inject-done → "Done" → result-ready（pipeline.rs run_polish 成功終端）
import { MODELS, STYLES, PROVIDERS, CURRENT_STYLE, INSTALLED, DEVICES, SEGMENTS, MEETING_RESULT, TYPE_INPUT, TYPE_RESULT, STORE } from "../data.js";
import { emit } from "./event.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__vtUnknown = new Set();

let currentStyle = CURRENT_STYLE;
const ACTIVE_MODEL = MODELS.find((m) => m.id === STORE.activeWhisperModel);

const HANDLERS = {
  cmd_get_platform: () => "macos",
  cmd_frontend_ready: () => {},
  cmd_record_frontend_error: () => {},
  cmd_check_claude: () => true,
  cmd_check_accessibility: () => true,
  cmd_check_microphone_permission: () => "granted",
  cmd_check_screen_capture_permission: () => true,
  cmd_detect_claude_path: () => STORE.claudeCliPath,
  cmd_get_claude_status: () => ({ path_found: true, executable: true, version: null, auth_status: "untested", message: "" }),
  cmd_installed_models: () => INSTALLED,
  cmd_list_models: () => MODELS,
  cmd_get_realtime_model_status: () => ({
    installed: false, loaded: false, enabled: false,
    selected_model_id: MODELS[0].id, loaded_model_id: null, loading_model_id: null, last_error: null,
  }),
  cmd_list_audio_devices: () => DEVICES,
  cmd_list_audio_sources: () => [],
  cmd_get_system_audio_status: () => ({ enabled: false, has_permission: true }),
  cmd_get_recording_dir: () => "~/Documents/VoiceType/recordings",
  cmd_get_voice_dict: () => ({ entries: [] }),
  cmd_list_profiles: () => STYLES,
  cmd_get_current_profile_id: () => currentStyle,
  cmd_set_current_profile: ({ id }) => { currentStyle = id; },
  cmd_list_providers: () => PROVIDERS,
  cmd_get_polish_runtime: () => ({ provider_id: "claude_cli", model_id: null }),
  cmd_health_check: ({ providerId }) => (providerId === "claude_cli" ? { kind: "Ready" } : { kind: "Other", message: "截圖環境未連線" }),
  cmd_list_llm_models: ({ providerId }) => ({
    provider_id: providerId,
    default_model: "Claude CLI 自動選擇（依帳號與 CLI 設定）",
    source: "claude_cli_help",
    models: ["sonnet", "opus"].map((id) => ({ id, label: id, kind: "alias" })),
  }),
  cmd_list_ollama_models: () => [],
  cmd_get_inject_mode: () => "auto",
  cmd_get_dictation_ai_polish_enabled: () => false,
  cmd_get_hotkey_mode: () => "toggle",
  cmd_get_hotkey_hold_delay_ms: () => 0,
  cmd_get_update_snapshot: () => null,
  cmd_get_queue_status: () => ({ ready: true, reason: null, pending: 0, running: 0, failed: 0, max_size: 20, tasks: [], background_polish: [] }),
  cmd_apply_toolbar_layout: ({ request }) => ({ stale: false, width: request?.width, height: request?.height, revision: request?.revision }),
  cmd_get_segments: () => SEGMENTS,

  cmd_start_streaming: async () => {
    setTimeout(async () => {
      await emit("recognition-mode-changed", { mode: "meeting", session_id: "demo-session", model_id: ACTIVE_MODEL.id, model_name: ACTIVE_MODEL.name });
      await emit("status-changed", "Recording");
    }, 0);
  },
  cmd_stop_recording: async () => {
    await emit("status-changed", "Transcribing");
    setTimeout(async () => {
      await emit("finalize-progress", { stage: "assembling", session_id: "demo-session", epoch: 1 });
      await emit("status-changed", "Processing");
      await sleep(300);
      await emit("inject-done", { kind: "PastedAuto", restore_failed: false });
      await emit("status-changed", "Done");
      await emit("result-ready", MEETING_RESULT);
    }, 100);
  },
  // 手動整理（TYPE「潤稿」、面板「AI 整理」）：後端 ai_summarize 同樣會 Processing → inject → Done → result-ready
  cmd_ai_summarize: async ({ text }) => {
    const result = text === TYPE_INPUT ? TYPE_RESULT : MEETING_RESULT;
    await emit("status-changed", "Processing");
    await sleep(300);
    await emit("inject-done", { kind: "PastedAuto", restore_failed: false });
    await emit("status-changed", "Done");
    await emit("result-ready", result);
    return result;
  },
};

// 純設定類指令（cmd_set_* 等）在截圖環境不需要做事
const NOOP = /^cmd_(set|load|repaint|open|request|start_wake|stop_wake)_/;

export async function invoke(cmd, args = {}) {
  const h = HANDLERS[cmd];
  if (h) return h(args);
  if (!NOOP.test(cmd)) window.__vtUnknown.add(cmd);
  return undefined;
}

export function convertFileSrc(p) { return p; }
