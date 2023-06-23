import createSidebar from '../../Layout/sidebar';
import defaultFavorites from '../../Favorites/defaultFavorites';
import Storage from '../../../Service/storage';
import basename from '../../Functions/path/basename';
interface Favorites {
	name: string;
	path: string;
	icon: string;
}

/**
 * Pin file(s) into sidebar
 * @param {string[]} filePaths - array of file path you want to pin into sidebar
 * @returns {void}
 */
const Pin = async (filePaths: string[]): Promise<void> => {
	const data = await Storage.get('favorites');
	let favorites = data?.favorites ?? [{ path: 'xplorer://Home', name: 'Home' }, ...(await defaultFavorites())];
	favorites.forEach((v: Favorites) => delete v.icon);
	for (const filePath of filePaths) {
		if (favorites.filter((favorite: Favorites) => favorite.path === filePath).length) {
			favorites = favorites.filter((favorite: Favorites) => favorite.path !== filePath);
		} else {
			favorites.push({ name: basename(filePath), path: filePath });
		}
	}
	Storage.set('favorites', { favorites });
	createSidebar();
};

export default Pin;
