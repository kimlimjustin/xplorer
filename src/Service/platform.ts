import isTauri from '../Util/is-tauri';

const OS = async (): Promise<string> => {
	if (isTauri) {
		const { os } = require('@tauri-apps/api');
		const platform = await os.platform();
		if (platform === 'windows') return 'win32';
		if (platform === 'macos') return 'darwin';
		return await os.platform();
	} else return 'web';
};
export default OS;
