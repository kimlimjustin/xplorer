import { GET_PLATFORM_ENDPOINT } from '../Util/constants';
import isTauri from '../Util/is-tauri';

const OS = async (): Promise<string> => {
	let platform: string;
	if (isTauri) {
		const { os } = require('@tauri-apps/api');
		platform = await os.platform();
	} else {
		platform = await (await fetch(GET_PLATFORM_ENDPOINT, { method: 'GET' })).json();
	}
	if (platform === 'windows') return 'win32';
	if (platform === 'macos') return 'darwin';
	return platform;
};
export default OS;

export const isWin11 = async (): Promise<boolean> => {
	const ua = await (navigator as any).userAgentData.getHighEntropyValues(['platformVersion']); //eslint-disable-line
	//eslint-disable-next-line
	if ((navigator as any).userAgentData.platform !== 'Windows') {
		return false;
	}
	return parseInt(ua.platformVersion.split('.')[0]) >= 13;
};
