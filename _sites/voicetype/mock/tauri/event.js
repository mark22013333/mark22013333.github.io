// 取代 @tauri-apps/api/event：在瀏覽器裡用記憶體事件表，截圖腳本透過 window.__vtEmit 觸發事件。
const handlers = new Map();

export async function listen(name, handler) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name).add(handler);
  return () => handlers.get(name)?.delete(handler);
}

export async function emit(name, payload) {
  for (const h of handlers.get(name) || []) h({ event: name, payload });
}

window.__vtEmit = emit;
