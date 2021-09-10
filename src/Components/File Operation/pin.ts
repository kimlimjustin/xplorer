import storage from 'electron-json-storage-sync';
import path from 'path';
import os from 'os';
import createSidebar from '../Layout/sidebar';

interface Favorites {
	name: string;
	path: string;
}

/**
 * Pin file(s) into sidebar
 * @param {string[]} filePaths - array of file path you want to pin into sidebar
 * @returns {void}
 */
const Pin = (filePaths: string[]): void => {
	const { data } = storage.get('sidebar');
	let favorites = data?.favorites ?? [
		{ name: 'Home', path: 'xplorer://Home' },
		{ name: 'Recent', path: 'xplorer://Recent' },
		{ name: 'Desktop', path: `${path.join(os.homedir(), 'Desktop')}` },
		{ name: 'Documents', path: `${path.join(os.homedir(), 'Documents')}` },
		{ name: 'Downloads', path: `${path.join(os.homedir(), 'Downloads')}` },
		{ name: 'Pictures', path: `${path.join(os.homedir(), 'Pictures')}` },
		{ name: 'Music', path: `${path.join(os.homedir(), 'Music')}` },
		{ name: 'Videos', path: `${path.join(os.homedir(), 'Videos')}` },
		{ name: 'Trash', path: 'xplorer://Trash' },
	];
	for (const filePath of filePaths) {
		if (
			favorites.filter(
				(favorite: Favorites) => favorite.path === filePath
			).length
		) {
			favorites = favorites.filter(
				(favorite: Favorites) => favorite.path !== filePath
			);
		} else {
			favorites.push({ name: path.basename(filePath), path: filePath });
		}
	}
	storage.set('sidebar', { favorites });
	createSidebar();
};

export default Pin;
