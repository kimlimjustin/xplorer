import isTauri from '../Util/is-tauri';
import { GET_FAVORITES_PATH_ENDPOINT } from '../Util/constants';
class FavoritesAPI {
	DOCUMENT_PATH: string;
	DOWNLOAD_PATH: string;
	DESKTOP_PATH: string;
	PICTURE_PATH: string;
	MUSIC_PATH: string;
	VIDEO_PATH: string;
	HOMEDIR_PATH: string;
	async build(): Promise<void> {
		if (!isTauri) {
			const res = await fetch(GET_FAVORITES_PATH_ENDPOINT);
			const data = await res.json();
			this.DOCUMENT_PATH = data.document;
			this.DOWNLOAD_PATH = data.download;
			this.DESKTOP_PATH = data.desktop;
			this.PICTURE_PATH = data.picture;
			this.MUSIC_PATH = data.audio;
			this.VIDEO_PATH = data.video;
			this.HOMEDIR_PATH = data.home;
		} else {
			const { path } = require('@tauri-apps/api');
			try {
				this.DOCUMENT_PATH = await path.documentDir();
				this.DOWNLOAD_PATH = await path.downloadDir();
				this.DESKTOP_PATH = await path.desktopDir();
				this.PICTURE_PATH = await path.pictureDir();
				this.MUSIC_PATH = await path.audioDir();
				this.VIDEO_PATH = await path.videoDir();
				// eslint-disable-next-line no-empty
			} catch (_) {}
			try {
				this.HOMEDIR_PATH = await path.homeDir();
				// eslint-disable-next-line no-empty
			} catch (_) {}
		}
	}
}

export default FavoritesAPI;
