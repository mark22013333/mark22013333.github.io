// 取代 @tauri-apps/plugin-notification：不發系統通知。
export async function isPermissionGranted() { return false; }
export async function requestPermission() { return "denied"; }
export function sendNotification() {}
