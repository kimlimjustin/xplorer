import FavoritesAPI from '../../Api/favorites';
import windowGUID from '../Constants/windowGUID';

/**
 * Get the tab focusing path
 * @returns {string}
 */
const focusingPath = (): string => {
	const tabs = JSON.parse(localStorage.getItem(`tabs-${windowGUID}`))?.data;
	const favoriteData = new FavoritesAPI();
	favoriteData.build();
	return tabs.tabs[tabs.focus].position === 'xplorer://Home' &&
		process.platform === 'linux'
		? favoriteData.HOMEDIR_PATH
		: tabs.tabs[tabs.focus].position;
};

export default focusingPath;
