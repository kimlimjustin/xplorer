import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import DirectoryAPI from '../../Service/directory';
import Storage from '../../Service/storage';
import defaultFavorites from './defaultFavorites';
import FileAPI from '../../Service/files';

const isDefaultFavorite = async (filePath: string) => {
	return (await defaultFavorites()).some((favorite) => favorite.path === filePath);
};

/**
 * Create favorites section
 * @returns {{Promise<string>} Favorites section HTML code
 */
const Favorites = async (): Promise<string> => {
	const data = await Storage.get('favorites'); // Get user favorites data on sidebar
	const favorites = data?.favorites ?? (await defaultFavorites());

	let result = '<section class="home-section">';
	result += `<h1 class="section-title">${await Translate('Favorites')}</h1>`;
	const defaultFavoritesList = (await defaultFavorites()).map((favorite) => favorite.name);
	for (const favorite of favorites) {
		if (!favorite.path) continue;
		if (favorite.path === 'xplorer://Home') continue;
		const fileData = new FileAPI(favorite.path);
		const exists = await fileData.exists();
		if (!exists && !(await isDefaultFavorite(favorite.path))) continue;
		let icon = favorite.icon;
		if (!icon) {
			if (defaultFavoritesList.indexOf(favorite.name) === -1) {
				const isdir = await new DirectoryAPI(favorite.path).isDir();
				icon = await fileThumbnail(exists ? favorite.path : favorite.name, isdir ? 'folder' : 'file', false);
			} else {
				icon = await fileThumbnail(favorite.name.toLowerCase(), 'folder', false);
			}
		}
		result += `<div
		class="favorite file card-hover-effect"
		data-isdir="${(await isDefaultFavorite(favorite.path)) ? true : await fileData.isDir()}"
		data-path="${favorite.path}"
	>
		<h3 class="favorite-title">
			<img
				src="${icon}"
				alt="${favorite.name} icon"
				class="favorite-icon"
			/>${await Translate(favorite.name)}
		</h3>
	</div>`;
	}
	return result;
};
export default Favorites;
