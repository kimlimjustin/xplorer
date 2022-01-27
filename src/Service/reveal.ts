import { invoke } from '@tauri-apps/api';
/**
 * Open file/dir in a specified application
 * @returns {any}
 */
const reveal = async (path: string, app: string): Promise<void> => {
	switch (app) {
		case 'vscode':
			return await invoke('open_in_vscode', { path });
		case 'terminal':
			return await invoke('open_in_terminal', { folderPath: path });
	}
};
export default reveal;
