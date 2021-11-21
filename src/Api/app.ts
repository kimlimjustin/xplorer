import { invoke } from '@tauri-apps/api';
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

export { isVSCodeInstalled, getAvailableFonts };
