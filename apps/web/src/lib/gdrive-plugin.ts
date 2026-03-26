// Mock Google Drive plugin for web context

export interface GoogleDriveAccount {
  id: string;
  email: string;
  displayName: string;
  isConnected: boolean;
  lastSynced?: string;
}

class GDriveManager {
  getAllAccounts(): GoogleDriveAccount[] { return []; }
  getAccounts(): GoogleDriveAccount[] { return []; }
  isConnected(): boolean { return false; }
  addEventListener(_event: string, _handler: () => void) {}
  removeEventListener(_event: string, _handler: () => void) {}
}

export const gdriveManager = new GDriveManager();
