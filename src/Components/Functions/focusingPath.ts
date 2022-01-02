import OS from '../../Service/platform';
import FavoritesAPI from '../../Service/favorites';

let favoriteData: FavoritesAPI;
let platform: string;
/**
 * Get the tab focusing path
 * @returns {Promise<string>}
 */
const focusingPath = async (): Promise<string> => {
	const PathNavigator = document.querySelector('.path-navigator') as HTMLInputElement;
	if (!favoriteData) {
		favoriteData = new FavoritesAPI();
		await favoriteData.build();
	}
	if (!platform) {
		platform = await OS();
	}
	return PathNavigator.value === 'xplorer://Home' && platform === 'linux' ? favoriteData.HOMEDIR_PATH : PathNavigator.value;
};

export default focusingPath;
