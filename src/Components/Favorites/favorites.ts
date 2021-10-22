import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import FavoritesAPI from '../../Api/favorites';
import DirectoryAPI from '../../Api/directory';
let FavoritesData: FavoritesAPI;

/**
 * Create favorites section
 * @returns {{Promise<string>} Favorites section HTML code
 */
const Favorites = async (): Promise<string> => {
	if (!FavoritesData) {
		FavoritesData = new FavoritesAPI();
		await FavoritesData.build();
	}
	const data = JSON.parse(localStorage.getItem('favorites')); // Get user favorites data on sidebar
	const favorites = data?.favorites ?? [
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

	let result = '<section class="home-section">';
	for (const favorite of favorites) {
		let icon = favorite.icon;
		if (!icon) {
			const isdir = await new DirectoryAPI(favorite.path).isDir();
			icon = await fileThumbnail(
				favorite.name,
				isdir ? 'folder' : 'file',
				false
			);
		}
		result += `<div
		class="favorite file card-hover-effect"
		data-isdir="true"
		data-path="${favorite.path}"
	>
		<h3 class="favorite-title">
			<img
				src="${icon}"
				alt="${favorite.name} icon"
				class="favorite-icon"
			/>${favorite.name}
		</h3>
	</div>`;
	}
	return result;
};
export default Favorites;
