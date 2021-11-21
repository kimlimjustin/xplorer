import { path } from '@tauri-apps/api';

class FavoritesAPI {
	DOCUMENT_PATH: string;
	DOWNLOAD_PATH: string;
	DESKTOP_PATH: string;
	PICTURE_PATH: string;
	MUSIC_PATH: string;
	VIDEO_PATH: string;
	HOMEDIR_PATH: string;
	async build(): Promise<void> {
		this.DOCUMENT_PATH = await path.documentDir();
		this.DOWNLOAD_PATH = await path.downloadDir();
		this.DESKTOP_PATH = await path.desktopDir();
		this.PICTURE_PATH = await path.pictureDir();
		this.MUSIC_PATH = await path.audioDir();
		this.VIDEO_PATH = await path.videoDir();
		this.HOMEDIR_PATH = await path.homeDir();
	}
}

export default FavoritesAPI;
