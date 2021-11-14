const defaultThumbnail = {
	DEFAULT_FILE_THUMBNAIL: 'file.svg',
	DEFAULT_FOLDER_THUMBNAIL: 'folder.svg',
	DEFAULT_IMAGE_THUMBNAIL: 'extension/image.svg',
	DEFAULT_VIDEO_THUMBNAIL: 'extension/video.svg',
};

interface customThumbnailType {
	[key: string]: string;
}
const customThumbnail: customThumbnailType = {
	'sidebar-about': 'folder/sidebar-about.svg',
	'sidebar-recent': 'folder/sidebar-recent.svg',
	'sidebar-favorites': 'folder/sidebar-favorite.svg',
	'sidebar-setting': 'folder/sidebar-setting.svg',
	'sidebar-trash': 'folder/sidebar-trash.svg',
	'sidebar-desktop': 'folder/sidebar-desktop.svg',
	'sidebar-home': 'folder/sidebar-home.svg',
	'sidebar-documents': 'folder/sidebar-document.svg',
	'sidebar-downloads': 'folder/sidebar-download.svg',
	'sidebar-music': 'folder/sidebar-music.svg',
	'sidebar-pictures': 'folder/sidebar-picture.svg',
	'sidebar-videos': 'folder/sidebar-video.svg',
	'settings-about': 'folder/setting-about.svg',
	'settings-appearance': 'folder/setting-appearance.svg',
	'settings-preference': 'folder/setting-preference.svg',
	'favorites-usb': 'usb.svg',
	'favorites-hard-disk': 'hard-disk.svg',
};
export { customThumbnail, defaultThumbnail };
