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
				'doc',
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
			folderNames: ['.git', 'git', 'patch'],
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
		{
			folderNames: ['app', 'apps'],
			thumbnail: 'folder/folder-app.svg',
		},
		{
			folderNames: [
				'archival',
				'archive',
				'archives',
				'backup',
				'backups',
			],
			thumbnail: 'folder/folder-archive.svg',
			type: 'Archived',
		},
		{
			folderNames: [
				'asset',
				'assets',
				'report',
				'reports',
				'res',
				'resources',
				'resource',
				'src',
				'static',
			],
			thumbnail: 'folder/folder-resource.svg',
			type: 'Resources',
		},
		{
			folderNames: ['backend', 'server', 'servers'],
			thumbnail: 'folder/folder-server.svg',
		},
		{
			folderNames: ['bin', 'dist', 'build', 'out', 'outs', 'release'],
			thumbnail: 'folder/folder-dist.svg',
			type: 'Packaged Distributions',
		},
		{
			folderNames: ['client', 'clients', 'frontend', 'pwa'],
			thumbnail: 'folder/folder-client.svg',
		},
		{
			folderNames: ['database', 'data', 'db', 'databases'],
			thumbnail: 'folder/folder-database.svg',
			type: 'Database',
		},
		{
			folderNames: ['font', 'fonts'],
			thumbnail: 'folder/folder-font.svg',
		},
		{
			folderNames: ['function', 'functions', 'math'],
			thumbnail: 'folder/folder-function.svg',
		},
		{
			folderNames: [
				'html',
				'page',
				'pages',
				'screen',
				'screens',
				'view',
				'views',
			],
			thumbnail: 'folder/folder-view.svg',
		},
		{
			folderNames: ['javascript', 'js'],
			thumbnail: 'folder/folder-javascript.svg',
		},
		{
			folderNames: [
				'lib',
				'libraries',
				'library',
				'third-party',
				'vendor',
				'vendors',
			],
			thumbnail: 'folder/folder-lib.svg',
		},
		{
			folderNames: ['project', 'projects'],
			thumbnail: 'folder/folder-project.svg',
		},
		{
			folderNames: ['python, __pycache__'],
			thumbnail: 'folder/folder-python.svg',
		},
		{
			folderNames: ['script', 'scripts'],
			thumbnail: 'folder/folder-scripts.svg',
		},
		{
			folderNames: ['template', 'templates'],
			thumbnail: 'folder/folder-template.svg',
		},
		{
			folderNames: ['test', 'jest', 'mocha'],
			thumbnail: 'folder/folder-test.svg',
		},
	];
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
export { customThumbnail };
