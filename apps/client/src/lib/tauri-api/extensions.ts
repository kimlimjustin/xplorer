import { transport } from '../transport';
import type { ExtensionManifestInfo, ExtensionPackageInfo } from '../tauri-api-types';

// ── Extension-scoped storage ────────────────────────────────────────────────

export const getExtensionStorage = async (extensionId: string, key: string): Promise<unknown> =>
  await transport('get_extension_storage', { extensionId, key });

export const setExtensionStorage = async (
  extensionId: string,
  key: string,
  value: unknown,
): Promise<void> => await transport('set_extension_storage', { extensionId, key, value });

export const deleteExtensionStorage = async (extensionId: string, key: string): Promise<void> =>
  await transport('delete_extension_storage', { extensionId, key });

// ── Extension management ────────────────────────────────────────────────────

export const getInstalledExtensions = async (): Promise<ExtensionPackageInfo[]> =>
  await transport('get_installed_extensions');

export const installExtensionFromPath = async (
  extensionPath: string,
): Promise<ExtensionPackageInfo> =>
  await transport('install_extension_from_path', { extensionPath });

export const uninstallExtensionById = async (extensionId: string): Promise<void> =>
  await transport('uninstall_extension_by_id', { extensionId });

export const activateExtension = async (extensionId: string): Promise<void> =>
  await transport('activate_extension', { extensionId });

export const deactivateExtension = async (extensionId: string): Promise<void> =>
  await transport('deactivate_extension', { extensionId });

export const getActiveExtensionIds = async (): Promise<string[]> =>
  await transport('get_active_extension_ids');

export const getExtensionPermissions = async (extensionId: string): Promise<string[]> =>
  await transport('get_extension_permissions', { extensionId });

export const validateExtensionPath = async (
  extensionPath: string,
): Promise<ExtensionManifestInfo> => await transport('validate_extension_path', { extensionPath });

export const downloadAndInstallExtension = async (
  downloadUrl: string,
  extensionId: string,
  expectedChecksum?: string,
): Promise<ExtensionPackageInfo> =>
  await transport('download_and_install_extension', {
    downloadUrl,
    extensionId,
    expectedChecksum: expectedChecksum || null,
  });

// ── .xtension file operations ───────────────────────────────────────────────

export const packExtension = async (extensionDir: string, outputPath?: string): Promise<string> =>
  await transport('pack_extension', { extensionDir, outputPath: outputPath || null });

export const installXtensionFile = async (xtensionPath: string): Promise<ExtensionPackageInfo> =>
  await transport('install_xtension_file', { xtensionPath });

export const inspectXtensionFile = async (xtensionPath: string): Promise<ExtensionManifestInfo> =>
  await transport('inspect_xtension_file', { xtensionPath });

export const nativePluginInvoke = async (
  extensionId: string,
  pluginId: string,
  command: string,
  args: Record<string, unknown>,
): Promise<unknown> =>
  await transport('native_plugin_invoke', { extensionId, pluginId, command, args });

export const extensionBackendCall = async (
  extensionId: string,
  method: string,
  args: Record<string, unknown>,
): Promise<unknown> =>
  await transport('extension_backend_call', {
    extensionId,
    method,
    args: JSON.stringify(args),
  });

export const extensionBackendStatus = async (extensionId: string): Promise<{ loaded: boolean }> =>
  await transport('extension_backend_status', { extensionId });

export const checkForExtensionUpdates = async (
  marketplaceUrl: string,
  installedExtensions: Array<{ id: string; version: string }>,
): Promise<
  Array<{
    id: string;
    current_version: string;
    latest_version: string;
    download_url: string;
    checksum: string;
    changelog?: string;
  }>
> =>
  await transport('check_for_extension_updates', {
    marketplaceUrl,
    installedExtensions,
  });

export const downloadExtensionUpdate = async (
  extensionId: string,
  downloadUrl: string,
  checksum?: string,
): Promise<string> =>
  await transport('download_extension_update', {
    extensionId,
    downloadUrl,
    checksum,
  });
