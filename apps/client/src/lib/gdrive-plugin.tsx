import React from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { ContextMenuItem } from '@/components/ui/ContextMenu';
import { ContextMenuExtension } from '@/lib/context-menu-factory';
import { Cloud, CircleDot, Plus, Settings } from 'lucide-react';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface GoogleDriveAccount {
  id: string;
  email: string;
  displayName: string;
  isConnected: boolean;
  lastSynced?: string;
}

interface GDrivePluginSettings {
  accounts: GoogleDriveAccount[];
}

// ═══════════════════════════════════════════
// Google Drive Manager
// ═══════════════════════════════════════════

interface CacheEntry {
  files: FileEntry[];
  timestamp: number;
}

const FILE_CACHE_KEY = 'gdrive-file-cache';
const FILE_CACHE_MAX_ENTRIES = 50;

export class GoogleDriveManager {
  private accounts: Map<string, GoogleDriveAccount> = new Map();
  private settings: GDrivePluginSettings;
  private fileCache: Map<string, CacheEntry> = new Map();

  constructor() {
    this.settings = this.loadSettings();
    this.loadAccounts();
    this.loadFileCache();
    // Sync with backend on startup
    this.syncAccounts();
  }

  // Settings persistence (localStorage)
  private loadSettings(): GDrivePluginSettings {
    try {
      const saved = localStorage.getItem('gdrive-plugin-settings');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return { accounts: [] };
  }

  private saveSettings(): void {
    this.settings.accounts = Array.from(this.accounts.values());
    localStorage.setItem('gdrive-plugin-settings', JSON.stringify(this.settings));
  }

  private loadAccounts(): void {
    for (const account of this.settings.accounts) {
      this.accounts.set(account.id, account);
    }
  }

  private async syncAccounts(): Promise<void> {
    try {
      const backendAccounts = await TauriAPI.gdriveListAccounts();
      for (const ba of backendAccounts) {
        if (!this.accounts.has(ba.id)) {
          this.accounts.set(ba.id, {
            id: ba.id,
            email: ba.email,
            displayName: ba.display_name,
            isConnected: true,
          });
        } else {
          const existing = this.accounts.get(ba.id)!;
          existing.isConnected = true;
          existing.email = ba.email;
        }
      }
      this.saveSettings();
      this.notifyChange();
    } catch {
      /* Backend may not be ready yet */
    }
  }

  private notifyChange(): void {
    window.dispatchEvent(new CustomEvent('gdrive-accounts-changed'));
  }

  // ── File Cache ───────────────────────────
  private loadFileCache(): void {
    try {
      const saved = localStorage.getItem(FILE_CACHE_KEY);
      if (saved) {
        const entries: [string, CacheEntry][] = JSON.parse(saved);
        this.fileCache = new Map(entries);
      }
    } catch {
      /* ignore */
    }
  }

  private saveFileCache(): void {
    const entries = Array.from(this.fileCache.entries());
    // Prune to max entries, keeping most recent
    if (entries.length > FILE_CACHE_MAX_ENTRIES) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      entries.length = FILE_CACHE_MAX_ENTRIES;
    }
    localStorage.setItem(FILE_CACHE_KEY, JSON.stringify(entries));
  }

  private cacheKey(accountId: string, folderId: string): string {
    return `${accountId}:${folderId}`;
  }

  getCachedFiles(accountId: string, folderId: string): FileEntry[] | null {
    const entry = this.fileCache.get(this.cacheKey(accountId, folderId));
    return entry ? entry.files : null;
  }

  private clearAccountCache(accountId: string): void {
    for (const key of this.fileCache.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this.fileCache.delete(key);
      }
    }
    this.saveFileCache();
  }

  destroy(): void {
    // Cleanup if needed
  }

  // ── Authentication ─────────────────────
  async authenticate(): Promise<GoogleDriveAccount> {
    const result = await TauriAPI.gdriveAuthenticate();
    const account: GoogleDriveAccount = {
      id: result.id,
      email: result.email,
      displayName: result.display_name,
      isConnected: true,
    };
    this.accounts.set(account.id, account);
    this.saveSettings();
    this.notifyChange();
    return account;
  }

  async disconnect(accountId: string): Promise<boolean> {
    try {
      await TauriAPI.gdriveDisconnect(accountId);
      this.accounts.delete(accountId);
      this.clearAccountCache(accountId);
      this.saveSettings();
      this.notifyChange();
      return true;
    } catch {
      return false;
    }
  }

  removeAccount(accountId: string): boolean {
    if (!this.accounts.has(accountId)) return false;
    this.accounts.delete(accountId);
    this.clearAccountCache(accountId);
    this.saveSettings();
    this.notifyChange();
    return true;
  }

  // ── Getters ────────────────────────────
  getAccount(id: string): GoogleDriveAccount | undefined {
    return this.accounts.get(id);
  }

  getAllAccounts(): GoogleDriveAccount[] {
    return Array.from(this.accounts.values());
  }

  // ── Getters (alias) ──────────────────
  getAccounts(): GoogleDriveAccount[] {
    return this.getAllAccounts();
  }

  // ── File Operations ────────────────────
  async listFiles(accountId: string, folderId: string): Promise<FileEntry[]> {
    const files = await TauriAPI.gdriveListFiles(accountId, folderId);
    // Update cache
    this.fileCache.set(this.cacheKey(accountId, folderId), { files, timestamp: Date.now() });
    this.saveFileCache();
    return files;
  }

  async downloadFile(accountId: string, fileId: string, localPath: string): Promise<void> {
    await TauriAPI.gdriveDownloadFile(accountId, fileId, localPath);
  }

  async uploadFile(accountId: string, localPath: string, parentFolderId: string): Promise<void> {
    await TauriAPI.gdriveUploadFile(accountId, localPath, parentFolderId);
  }

  async deleteFile(accountId: string, fileId: string): Promise<void> {
    await TauriAPI.gdriveDeleteFile(accountId, fileId);
  }

  async renameFile(accountId: string, fileId: string, newName: string): Promise<void> {
    await TauriAPI.gdriveRenameFile(accountId, fileId, newName);
  }

  async moveFile(
    accountId: string,
    fileId: string,
    newParentId: string,
    oldParentId: string,
  ): Promise<void> {
    await TauriAPI.gdriveMoveFile(accountId, fileId, newParentId, oldParentId);
  }

  async createFolder(accountId: string, name: string, parentFolderId: string): Promise<void> {
    await TauriAPI.gdriveCreateFolder(accountId, name, parentFolderId);
  }

  async getFileContent(accountId: string, fileId: string): Promise<string> {
    return await TauriAPI.gdriveGetFileContent(accountId, fileId);
  }
}

// ═══════════════════════════════════════════
// Lazy Singleton
// ═══════════════════════════════════════════

let _gdriveManager: GoogleDriveManager | null = null;

const getInstance = () : GoogleDriveManager => {
  if (!_gdriveManager) {
    _gdriveManager = new GoogleDriveManager();
  }
  return _gdriveManager;
}

export const gdriveManager = {
  authenticate() {
    return getInstance().authenticate();
  },
  disconnect(accountId: string) {
    return getInstance().disconnect(accountId);
  },
  removeAccount(accountId: string) {
    return getInstance().removeAccount(accountId);
  },
  getAccount(id: string) {
    return getInstance().getAccount(id);
  },
  getAllAccounts() {
    return getInstance().getAllAccounts();
  },
  getAccounts() {
    return getInstance().getAccounts();
  },
  getCachedFiles(accountId: string, folderId: string) {
    return getInstance().getCachedFiles(accountId, folderId);
  },
  listFiles(accountId: string, folderId: string) {
    return getInstance().listFiles(accountId, folderId);
  },
  downloadFile(accountId: string, fileId: string, localPath: string) {
    return getInstance().downloadFile(accountId, fileId, localPath);
  },
  uploadFile(accountId: string, localPath: string, parentFolderId: string) {
    return getInstance().uploadFile(accountId, localPath, parentFolderId);
  },
  deleteFile(accountId: string, fileId: string) {
    return getInstance().deleteFile(accountId, fileId);
  },
  renameFile(accountId: string, fileId: string, newName: string) {
    return getInstance().renameFile(accountId, fileId, newName);
  },
  moveFile(accountId: string, fileId: string, newParentId: string, oldParentId: string) {
    return getInstance().moveFile(accountId, fileId, newParentId, oldParentId);
  },
  createFolder(accountId: string, name: string, parentFolderId: string) {
    return getInstance().createFolder(accountId, name, parentFolderId);
  },
  getFileContent(accountId: string, fileId: string) {
    return getInstance().getFileContent(accountId, fileId);
  },
  destroy() {
    if (_gdriveManager) {
      _gdriveManager.destroy();
      _gdriveManager = null;
    }
  },
};

// ═══════════════════════════════════════════
// Google Drive Context Menu Extension
// ═══════════════════════════════════════════

export class GoogleDriveContextMenuExtension implements ContextMenuExtension {
  id = 'gdrive-extension';
  name = 'Google Drive Extension';

  getEmptySpaceActions(_currentPath: string): ContextMenuItem[] {
    const accounts = gdriveManager.getAllAccounts();

    if (accounts.length === 0) {
      return [
        {
          id: 'gdrive-connect',
          label: 'Connect Google Drive',
          icon: React.createElement(Cloud, { size: '1em', className: 'inline-block' }),
          action: async () => {
            try {
              await gdriveManager.authenticate();
            } catch (error) {
              console.error('Google Drive authentication failed:', error);
            }
          },
        },
      ];
    }

    return [
      {
        id: 'gdrive-accounts',
        label: 'Google Drive',
        icon: React.createElement(Cloud, { size: '1em', className: 'inline-block' }),
        submenu: [
          ...accounts.map((account: GoogleDriveAccount) => ({
            id: `gdrive-open-${account.id}`,
            label: `${account.displayName} (${account.email})`,
            icon: React.createElement(CircleDot, {
              size: '1em',
              className: `inline-block ${account.isConnected ? 'text-xp-green' : 'text-xp-red'}`,
            }),
            action: () => {
              window.dispatchEvent(
                new CustomEvent('open-gdrive-tab', {
                  detail: { accountId: account.id, accountName: account.displayName },
                }),
              );
            },
          })),
          {
            id: 'gdrive-add-account',
            label: 'Add Account...',
            icon: React.createElement(Plus, { size: '1em', className: 'inline-block' }),
            action: async () => {
              try {
                await gdriveManager.authenticate();
              } catch (error) {
                console.error('Google Drive authentication failed:', error);
              }
            },
          },
          {
            id: 'gdrive-manage',
            label: 'Manage Accounts...',
            icon: React.createElement(Settings, { size: '1em', className: 'inline-block' }),
            action: () => {
              window.dispatchEvent(new CustomEvent('open-gdrive-management'));
            },
          },
        ],
      },
    ];
  }
}
