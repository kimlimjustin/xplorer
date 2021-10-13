interface folderThumbnailType {
	folderNames: string[];
	thumbnail?: string;
	type?: string;
}
const folderConfig = (): folderThumbnailType[] => {
	return [
		{
			folderNames: [
				'document',
				'documents',
				'article',
				'articles',
				'documentation',
				'docs',
				'post',
				'posts',
			],
			thumbnail: 'folder/folder-document.svg',
		},
		{
			folderNames: ['download', 'downloads'],
			thumbnail: 'folder/folder-download.svg',
		},
		{
			folderNames: [
				'picture',
				'pictures',
				'ico',
				'icon',
				'image',
				'icons',
				'images',
				'img',
				'screenshot',
				'screenshots',
			],
			thumbnail: 'folder/folder-picture.svg',
		},
		{
			folderNames: ['music'],
			thumbnail: 'folder/folder-music.svg',
		},
		{
			folderNames: ['desktop'],
			thumbnail: 'folder/folder-desktop.svg',
		},
		{
			folderNames: ['video', 'videos'],
			thumbnail: 'folder/folder-video.svg',
		},
		{
			folderNames: ['home'],
			thumbnail: 'folder/folder-home.svg',
		},
		{
			folderNames: ['trash'],
			thumbnail: 'folder/folder-trash.svg',
		},
		{
			folderNames: ['setting', 'settings'],
			thumbnail: 'folder/folder-setting.svg',
		},
		{
			folderNames: ['recent', 'recents'],
			thumbnail: 'folder/folder-recent.svg',
		},
		{
			folderNames: ['favorite', 'favorites'],
			thumbnail: 'folder/folder-favorite.svg',
		},
		{
			folderNames: ['about'],
			thumbnail: 'folder/setting-about.svg',
		},
		{
			folderNames: ['appearance'],
			thumbnail: 'folder/setting-appearance.svg',
		},
		{
			folderNames: ['preference'],
			thumbnail: 'folder/setting-preference.svg',
		},
		{
			folderNames: ['.git', 'git'],
			thumbnail: 'folder/folder-git.svg',
			type: 'Version Control System',
		},
		{
			folderNames: ['android'],
			thumbnail: 'folder/folder-android.svg',
		},
		{
			folderNames: ['node_modules'],
			type: 'Node Package Modules',
			thumbnail: 'folder/folder-node.svg',
		},
	];
};
const defaultThumbnail = {
	file: 'file.svg',
	folder: 'folder.svg',
	image: 'extension/image.svg',
	video: 'extension/video.svg',
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
export default folderConfig;
export { defaultThumbnail, customThumbnail };
