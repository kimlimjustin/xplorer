// Mock @tauri-apps/api/window for web context

class MockWindow {
  async isMaximized() { return false; }
  async onResized(_handler: () => void) { return { unsubscribe: () => {} }; }
  async startDragging() {}
  async toggleMaximize() {}
  async minimize() {}
  async close() {}
  async setTitle(_title: string) {}
}

const mockWindow = new MockWindow();

export function getCurrentWindow() {
  return mockWindow;
}

export const appWindow = mockWindow;
