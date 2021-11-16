import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import FavoritesAPI from '../../Api/favorites';
import DirectoryAPI from '../../Api/directory';
import Storage from '../../Api/storage';
import defaultFavorites from './defaultFavorites';
import FileAPI from '../../Api/files';
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
	const data = await Storage.get('favorites'); // Get user favorites data on sidebar
	const favorites = data?.favorites ?? (await defaultFavorites());

	let result = '<section class="home-section">';
	result += `<h1 class="section-title">${await Translate('Favorites')}</h1>`;
	const defaultFavoritesList = (await defaultFavorites()).map((favorite) => favorite.name);
	for (const favorite of favorites) {
		if (favorite.path === 'xplorer://Home') continue;
		let icon = favorite.icon;
		if (!icon) {
			if (defaultFavoritesList.indexOf(favorite.name) === -1) {
				const isdir = await new DirectoryAPI(favorite.path).isDir();
				const exists = await new FileAPI(favorite.path).exists();
				icon = await fileThumbnail(exists ? favorite.path : favorite.name, isdir ? 'folder' : 'file', false);
			} else {
				icon = await fileThumbnail(favorite.name.toLowerCase(), 'folder', false);
			}
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
