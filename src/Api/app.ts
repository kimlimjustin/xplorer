import { invoke } from '@tauri-apps/api';
import { getCurrent } from '@tauri-apps/api/window';
import { convertToHtml } from 'mammoth';
let _vscodeInstalled: boolean | undefined;
const isVSCodeInstalled = async (): Promise<boolean> => {
	if (_vscodeInstalled === undefined) {
		_vscodeInstalled = await invoke('check_vscode_installed');
	}
	return _vscodeInstalled;
};

const getAvailableFonts = async (): Promise<string[]> => {
	return await invoke('get_available_fonts');
};
let listened = false;
const listenStylesheetChange = async (cb: (stylesheet: JSON) => void): Promise<void> => {
	if (!listened) {
		invoke('listen_stylesheet_change');
		getCurrent().listen('stylesheet_changes', (e) => {
			cb(e.payload as JSON);
		});
		listened = true;
	}
};

export { isVSCodeInstalled, getAvailableFonts, listenStylesheetChange };
