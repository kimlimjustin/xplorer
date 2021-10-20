import { path } from '@tauri-apps/api';

class LocalesAPI {
	LOCALES_FOLDER: string;
	LOCALE_PATH: {
		[key: string]: string;
	};
	async build(): Promise<void> {
		this.LOCALES_FOLDER = await path.resolve(
			await path.currentDir(),
			'../src/Locales'
		);
	}
}

export default LocalesAPI;
