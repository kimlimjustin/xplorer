import fileThumbnail from '../Thumbnail/thumbnail';
import FavoritesAPI from '../../Service/favorites';
let FavoritesData: FavoritesAPI;
interface Favorites {
	name: string;
	path: string;
	icon: string;
}
export default async function defaultFavorites(): Promise<Favorites[]> {
	if (!FavoritesData) {
		FavoritesData = new FavoritesAPI();
		await FavoritesData.build();
	}
	return [
		{
			name: 'Recent',
			path: 'xplorer://Recent',
			icon: await fileThumbnail('recent', 'folder', false),
		},
		{
			name: 'Desktop',
			path: FavoritesData.DESKTOP_PATH,
			icon: await fileThumbnail('desktop', 'folder', false),
		},
		{
			name: 'Documents',
			path: FavoritesData.DOCUMENT_PATH,
			icon: await fileThumbnail('document', 'folder', false),
		},
		{
			name: 'Downloads',
			path: FavoritesData.DOWNLOAD_PATH,
			icon: await fileThumbnail('download', 'folder', false),
		},
		{
			name: 'Pictures',
			path: FavoritesData.PICTURE_PATH,
			icon: await fileThumbnail('picture', 'folder', false),
		},
		{
			name: 'Music',
			path: FavoritesData.MUSIC_PATH,
			icon: await fileThumbnail('music', 'folder', false),
		},
		{
			name: 'Videos',
			path: FavoritesData.VIDEO_PATH,
			icon: await fileThumbnail('video', 'folder', false),
		},
		{
			name: 'Trash',
			path: 'xplorer://Trash',
			icon: await fileThumbnail('trash', 'folder', false),
		},
	];
}
