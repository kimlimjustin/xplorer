import { transport } from '../transport';
import type { ShortcutBinding, ShortcutSettings, ShortcutAction } from '../types';

export const getShortcuts = async (): Promise<ShortcutBinding[]> => {
  return await transport('get_shortcuts');
};

export const getShortcutsByCategory = async (category: string): Promise<ShortcutBinding[]> => {
  return await transport('get_shortcuts_by_category', { category });
};

export const addShortcut = async (binding: ShortcutBinding): Promise<void> => {
  return await transport('add_shortcut', { shortcut: binding });
};

export const updateShortcut = async (binding: ShortcutBinding): Promise<void> => {
  return await transport('update_shortcut', { binding });
};

export const removeShortcut = async (shortcutId: string): Promise<void> => {
  return await transport('remove_shortcut', { shortcutId });
};

export const getShortcutProfiles = async (): Promise<string[]> => {
  return await transport('get_shortcut_profiles');
};

export const switchShortcutProfile = async (profileId: string): Promise<void> => {
  return await transport('switch_shortcut_profile', { profileId });
};

export const getShortcutSettings = async (): Promise<ShortcutSettings> => {
  return await transport('get_shortcut_settings');
};

export const updateShortcutSettings = async (settings: ShortcutSettings): Promise<void> => {
  return await transport('update_shortcut_settings', { settings });
};

export const executeShortcutAction = async (
  keyCombination: string,
  context: string,
): Promise<ShortcutAction | null> => {
  if (!keyCombination) return null;
  return await transport('execute_shortcut_action', { keyCombination, context });
};

export const registerGlobalShortcuts = async (): Promise<void> => {
  return await transport('register_global_shortcuts');
};

export const unregisterGlobalShortcuts = async (): Promise<void> => {
  return await transport('unregister_global_shortcuts');
};

export const toggleGlobalShortcuts = async (enabled: boolean): Promise<void> => {
  return await transport('toggle_global_shortcuts', { enabled });
};

export const resetShortcuts = async (profileId?: string): Promise<void> => {
  return await transport('reset_shortcuts', { profileId: profileId ?? null });
};

export const resetSingleShortcut = async (shortcutId: string): Promise<ShortcutBinding> => {
  return await transport('reset_single_shortcut', { shortcutId });
};
