import { path } from '@tauri-apps/api';

class ThumbnailAPI {
	DEFAULT_FILE_ICON: string;
	DEFAULT_FOLDER_ICON: string;
	DEFAULT_IMAGE_ICON: string;
	DEFAULT_VIDEO_ICON: string;
	async build(): Promise<void> {
		this.DEFAULT_FILE_ICON = await path.resolve(
			await path.currentDir(),
			'../src/Icon/file.svg'
		);
		this.DEFAULT_FOLDER_ICON = await path.resolve(
			await path.currentDir(),
			'../src/Icon/folder.svg'
		);
		this.DEFAULT_IMAGE_ICON = await path.resolve(
			await path.currentDir(),
			'../src/Icon/extension/image.svg'
		);
		this.DEFAULT_VIDEO_ICON = await path.resolve(
			await path.currentDir(),
			'../src/Icon/extension/video.svg'
		);
	}
}

export default ThumbnailAPI;
