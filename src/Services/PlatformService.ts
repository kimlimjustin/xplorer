import { os } from "@tauri-apps/api"

export const getOS = async (): Promise<string> => {
  const platform = await os.platform();

  switch (platform) {
    case 'windows': return 'win32';
    case 'macos': return 'darwin';
    default: return platform;
  }
}