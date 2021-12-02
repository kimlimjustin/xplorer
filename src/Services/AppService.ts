import { invoke } from '@tauri-apps/api';

export const fetchVSCodeInstalled = async (): Promise<boolean> => invoke('check_vscode_installed');
export const fetchAvailableFonts = async (): Promise<string[]> => invoke('get_available_fonts');
