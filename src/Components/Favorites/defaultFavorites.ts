import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import FavoritesAPI from '../../Api/favorites';
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
			name: await Translate('Recent'),
			path: 'xplorer://Recent',
			icon: await fileThumbnail('recent', 'folder', false),
		},
		{
			name: await Translate('Desktop'),
			path: FavoritesData.DESKTOP_PATH,
			icon: await fileThumbnail('desktop', 'folder', false),
		},
		{
			name: await Translate('Documents'),
			path: FavoritesData.DOCUMENT_PATH,
			icon: await fileThumbnail('document', 'folder', false),
		},
		{
			name: await Translate('Downloads'),
			path: FavoritesData.DOWNLOAD_PATH,
			icon: await fileThumbnail('download', 'folder', false),
		},
		{
			name: await Translate('Pictures'),
			path: FavoritesData.PICTURE_PATH,
			icon: await fileThumbnail('picture', 'folder', false),
		},
		{
			name: await Translate('Music'),
			path: FavoritesData.MUSIC_PATH,
			icon: await fileThumbnail('music', 'folder', false),
		},
		{
			name: await Translate('Videos'),
			path: FavoritesData.VIDEO_PATH,
			icon: await fileThumbnail('video', 'folder', false),
		},
		{
			name: await Translate('Trash'),
			path: 'xplorer://Trash',
			icon: await fileThumbnail('trash', 'folder', false),
		},
	];
}
