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

const changeTransparentEffect = async (transparentEffect: 'blur' | 'acrylic' | 'none'): Promise<void> => {
	return await invoke('change_transparent_effect', { effect: transparentEffect });
};

export { isVSCodeInstalled, getAvailableFonts, changeTransparentEffect };
