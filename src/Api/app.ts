import { invoke } from '@tauri-apps/api';
let _vscodeInstalled: boolean | undefined;
const isVSCodeInstalled = async (): Promise<boolean> => {
	if (_vscodeInstalled === undefined) {
		_vscodeInstalled = await invoke('check_vscode_installed');
		console.log(_vscodeInstalled);
	}
	return _vscodeInstalled;
};
export { isVSCodeInstalled };
