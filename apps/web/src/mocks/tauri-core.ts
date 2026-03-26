// Mock @tauri-apps/api/core for web context

export async function invoke(_command: string, _args?: Record<string, unknown>): Promise<unknown> {
  return null;
}
