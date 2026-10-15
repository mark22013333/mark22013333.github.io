// 取代 @tauri-apps/api/window：視窗尺寸由截圖腳本的 viewport 決定，這裡全部是空操作。
export class LogicalSize {
  constructor(width, height) { this.width = width; this.height = height; }
}

const noop = async () => {};
const win = {
  setSize: async (size) => { window.__vtWindowSize = size; },
  setMinSize: noop, setMaxSize: noop, setResizable: noop, startDragging: noop,
  hide: noop, show: noop, minimize: noop, toggleMaximize: noop, setFocus: noop,
  isVisible: async () => true,
  innerSize: async () => ({ width: innerWidth * (window.devicePixelRatio || 1), height: innerHeight * (window.devicePixelRatio || 1) }),
  scaleFactor: async () => window.devicePixelRatio || 1,
  onResized: async () => () => {},
  onMoved: async () => () => {},
  onFocusChanged: async () => () => {},
};

export function getCurrentWindow() { return win; }
