// 取代 @tauri-apps/plugin-store：設定只存在記憶體，不讀寫任何磁碟上的設定檔。
import { STORE } from "../data.js";

const data = { ...STORE };

export async function load() {
  return {
    get: async (k) => data[k],
    set: async (k, v) => { data[k] = v; },
    has: async (k) => k in data,
    delete: async (k) => { delete data[k]; },
    save: async () => {},
  };
}
