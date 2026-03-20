import { transport } from '../transport';

export interface BackupFileEntry {
  path: string;
  size: number;
  modified: number;
  hash: string;
  is_new: boolean;
  is_modified: boolean;
}

export interface BackupManifest {
  backup_id: string;
  timestamp: string;
  source_dir: string;
  files: BackupFileEntry[];
  total_size: number;
  backup_type: 'full' | 'incremental';
}

export interface BackupProgress {
  phase: string;
  current: number;
  total: number;
  current_file: string;
  percentage: number;
}

export const createBackup = async (
  sourceDir: string,
  backupDir: string,
  name: string,
): Promise<BackupManifest> => {
  return await transport('create_backup', { sourceDir, backupDir, name });
};

export const listBackups = async (
  backupDir: string,
  name: string,
): Promise<BackupManifest[]> => {
  return await transport('list_backups', { backupDir, name });
};

export const restoreBackup = async (
  backupId: string,
  backupDir: string,
  name: string,
  restoreTo: string,
): Promise<void> => {
  return await transport('restore_backup', { backupId, backupDir, name, restoreTo });
};

export const deleteBackup = async (
  backupId: string,
  backupDir: string,
  name: string,
): Promise<void> => {
  return await transport('delete_backup', { backupId, backupDir, name });
};
