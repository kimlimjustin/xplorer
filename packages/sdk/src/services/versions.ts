import { transport } from '../transport';

export interface FileVersion {
  version_number: number;
  timestamp: string;
  size: number;
  path: string;
  original_name: string;
}

export interface VersioningConfig {
  enabled_dirs: string[];
  max_versions_per_file: number;
  auto_version_on_save: boolean;
}

export const enableVersioning = async (directory: string): Promise<void> => {
  return await transport('enable_versioning', { directory });
};

export const disableVersioning = async (directory: string): Promise<void> => {
  return await transport('disable_versioning', { directory });
};

export const createVersion = async (filePath: string): Promise<FileVersion> => {
  return await transport('create_version', { filePath });
};

export const listVersions = async (filePath: string): Promise<FileVersion[]> => {
  return await transport('list_versions', { filePath });
};

export const restoreVersion = async (filePath: string, versionNumber: number): Promise<void> => {
  return await transport('restore_version', { filePath, versionNumber });
};

export const deleteVersion = async (filePath: string, versionNumber: number): Promise<void> => {
  return await transport('delete_version', { filePath, versionNumber });
};

export const getVersioningConfig = async (): Promise<VersioningConfig> => {
  return await transport('get_versioning_config');
};

export const updateVersioningConfig = async (config: VersioningConfig): Promise<void> => {
  return await transport('update_versioning_config', { config });
};

export const isVersioningEnabled = async (filePath: string): Promise<boolean> => {
  return await transport('is_versioning_enabled', { filePath });
};

export const getVersionCount = async (filePath: string): Promise<number> => {
  return await transport('get_version_count', { filePath });
};

export const deleteAllVersions = async (filePath: string): Promise<number> => {
  return await transport('delete_all_versions', { filePath });
};

export const readVersionContent = async (
  filePath: string,
  versionNumber: number,
): Promise<string> => {
  return await transport('read_version_content', { filePath, versionNumber });
};
