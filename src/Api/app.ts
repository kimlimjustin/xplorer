import { invoke } from '@tauri-apps/api';
import { getCurrent } from '@tauri-apps/api/window';
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

const changeTransparentEffect = async (transparentEffect: 'blur' | 'acrylic' | 'none'): Promise<void> => {
	return await invoke('change_transparent_effect', { effect: transparentEffect });
};

export { isVSCodeInstalled, getAvailableFonts, changeTransparentEffect, listenStylesheetChange };
