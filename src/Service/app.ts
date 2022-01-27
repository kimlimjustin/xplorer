import { GET_AVAILABLE_FONTS_ENDPOINT } from '../Util/constants';
import isTauri from '../Util/is-tauri';
let _vscodeInstalled: boolean | undefined;
const isVSCodeInstalled = async (): Promise<boolean> => {
	if (!isTauri) return false;
	const { invoke } = require('@tauri-apps/api');
	if (_vscodeInstalled === undefined) {
		_vscodeInstalled = await invoke('check_vscode_installed');
	}
	return _vscodeInstalled;
};

const getAvailableFonts = async (): Promise<string[]> => {
	if (isTauri) {
		const { invoke } = require('@tauri-apps/api');
		return await invoke('get_available_fonts');
	} else {
		const fonts = await (await fetch(GET_AVAILABLE_FONTS_ENDPOINT, { method: 'GET' })).json();
		return fonts;
	}
};
let listened = false;
const listenStylesheetChange = async (cb: (stylesheet: JSON) => void): Promise<void> => {
	if (!isTauri) return;
	if (!listened) {
		const { getCurrent } = require('@tauri-apps/api/window');
		const { invoke } = require('@tauri-apps/api');
		invoke('listen_stylesheet_change');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getCurrent().listen('stylesheet_changes', (e: any) => {
			cb(e.payload as JSON);
		});
		listened = true;
	}
};

const changeTransparentEffect = async (transparentEffect: 'blur' | 'acrylic' | 'none'): Promise<void> => {
	if (!isTauri) return;
	const { invoke } = require('@tauri-apps/api');
	return await invoke('change_transparent_effect', { effect: transparentEffect });
};

const enableShadowEffect = async (shadowEffect: boolean): Promise<void> => {
	if (!isTauri) return;
	const { invoke } = require('@tauri-apps/api');
	return await invoke('enable_shadow_effect', { effect: shadowEffect });
};

export { isVSCodeInstalled, getAvailableFonts, changeTransparentEffect, listenStylesheetChange, enableShadowEffect };
