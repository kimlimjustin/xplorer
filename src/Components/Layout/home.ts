import { Drives } from '../Drives/drives';
import Favorites from '../Favorites/favorites';
import { updateTheme } from '../Theme/theme';
import { startLoading, stopLoading } from '../Functions/Loading/loading';
import OS from '../../Service/platform';
import DirectoryAPI from '../../Service/directory';
import FavoritesAPI from '../../Service/favorites';
import displayFiles from '../Open/displayFiles';
import { LOAD_IMAGE } from '../Functions/lazyLoadingImage';
import { GET_TAB_ELEMENT } from '../../Util/constants';
let platform: string;
(async () => {
	platform = await OS();
})();

let favoritesData: FavoritesAPI;

/**
 * Create contents for home page
 * @returns {Promise<void>}
 */
const Home = async (): Promise<void> => {
	startLoading();
	// Get the main element
	const MAIN_ELEMENT = GET_TAB_ELEMENT();
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist
	const favorites = await Favorites();
	const drives = await Drives();
	MAIN_ELEMENT.innerHTML = favorites + drives;
	if (platform !== 'win32') {
		if (!favoritesData?.HOMEDIR_PATH) {
			favoritesData = new FavoritesAPI();
			await favoritesData.build();
		}
		const directoryInfo = new DirectoryAPI(favoritesData.HOMEDIR_PATH);
		const homeElement = document.createElement('section');
		homeElement.classList.add('home-section');
		homeElement.innerHTML = '<h1 class="section-title">Files</section>';

		const homeFiles = await directoryInfo.getFiles();
		const homeSection = await displayFiles(homeFiles.files, favoritesData.HOMEDIR_PATH, homeElement);
		// Update the content in the main page ...
		MAIN_ELEMENT.innerHTML = favorites + drives;
		MAIN_ELEMENT.appendChild(homeSection);

		// And also the theme :)
		updateTheme('favorites');
		updateTheme('grid');
		stopLoading();
	}
	updateTheme('favorites');
	stopLoading();
	LOAD_IMAGE();
};

export default Home;
