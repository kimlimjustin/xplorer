import FavoritesAPI from '../../Service/favorites';
let favoritesData: FavoritesAPI;
/**
 * Check for default sort algorithm for a given directory
 * @param {string} dir - directory to check
 * @returns {Promise<'A'|'Z'|'L'|'F'|'S'|'T'>}
 */
const getDefaultSort = async (dir: string): Promise<'A' | 'Z' | 'L' | 'F' | 'S' | 'T'> => {
	if (!favoritesData) {
		favoritesData = new FavoritesAPI();
		await favoritesData.build();
	}
	switch (dir) {
		case favoritesData.DOCUMENT_PATH:
			return 'L';
		case favoritesData.PICTURE_PATH:
			return 'L';
		case favoritesData.VIDEO_PATH:
			return 'L';
		case favoritesData.DESKTOP_PATH:
			return 'A';
		case favoritesData.DOWNLOAD_PATH:
			return 'L';
		case favoritesData.MUSIC_PATH:
			return 'A';
		default:
			return null;
	}
};

export default getDefaultSort;
