import { invoke } from '@tauri-apps/api';
import NormalizeSlash from '../Components/Functions/path/normalizeSlash';
/**
 * Open file/dir in a specified application
 * @returns {any}
 */
const reveal = async (path: string, app: string): Promise<void> => {
	switch (app) {
		case 'vscode':
			return await invoke('open_in_vscode', { path });
		case 'terminal':
			return await invoke('open_in_terminal', { folderPath: NormalizeSlash(path) });
	}
};
export default reveal;
