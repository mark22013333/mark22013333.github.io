// 取代 @tauri-apps/plugin-dialog：截圖時不開任何系統對話框。
export async function open() { return null; }
export async function save() { return null; }
export async function message() {}
export async function ask() { return false; }
export async function confirm() { return false; }
