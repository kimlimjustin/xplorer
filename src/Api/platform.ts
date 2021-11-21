import { os } from '@tauri-apps/api';

const OS = async (): Promise<string> => {
	const platform = await os.platform();
	if (platform === 'windows') return 'win32';
	if (platform === 'macos') return 'darwin';
	return await os.platform();
};
export default OS;
