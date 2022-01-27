import fileThumbnail from '../Thumbnail/thumbnail';
import { sidebarDrivesElement } from '../Drives/drives';
import { updateTheme } from '../Theme/theme';
import Translate from '../I18n/i18n';
import FavoritesAPI from '../../Service/favorites';
import DirectoryAPI from '../../Service/directory';
import Storage from '../../Service/storage';
import IsValid from '../Functions/validChecker';
import defaultFavorites from '../Favorites/defaultFavorites';
import FileAPI from '../../Service/files';
interface Favorites {
	name: string;
	path: string;
}

const changeSidebar = (newElement: HTMLElement) => {
	const sidebarElement = document.body.querySelector('.sidebar');
	sidebarElement.parentElement.replaceChild(newElement, sidebarElement);
	updateTheme('root');
	return;
};

let FavoritesData: FavoritesAPI;

let _defaultFavorites: Favorites[] = [];
const isDefaultFavorite = async (filePath: string) => {
	if (!IsValid(_defaultFavorites)) {
		_defaultFavorites = await defaultFavorites();
	}
	return _defaultFavorites.some((favorite) => favorite.path === filePath);
};

/**
 * Sidebar initializer function
 * @returns {Promise<void>}
 */
const createSidebar = async (): Promise<void> => {
	const sidebar = await Storage.get('sidebar');
	if (!FavoritesData) {
		FavoritesData = new FavoritesAPI();
		await FavoritesData.build();
	}
	// Functions to get favorites element
	const getFavoritesElement = async (favorites: Favorites[]) => {
		let favoritesElement = '';
		const defaultFavoritesList = (await defaultFavorites()).map((favorite) => favorite.name);
		for (const favorite of favorites) {
			if (!favorite.path) continue;
			const exists = await new FileAPI(favorite.path).exists();
			if (!(await isDefaultFavorite(favorite.path)) && !favorite.path.startsWith('xplorer://')) {
				if (!exists) continue;
			}
			const isdir = favorite.path.startsWith('xplorer://') ? true : await new DirectoryAPI(favorite.path).isDir();
			favoritesElement += `<span data-path = "${
				favorite.path
			}" data-isdir="${isdir}" class="sidebar-hover-effect sidebar-item"><img src="${await fileThumbnail(
				exists && !(await isDefaultFavorite(favorite.path)) ? favorite.path : favorite.name,
				defaultFavoritesList.indexOf(favorite.name) === -1 && favorite.path !== 'xplorer://Home' ? (isdir ? 'folder' : 'file') : 'sidebar',
				false
			)}" alt="${favorite.name} icon"><span class="sidebar-text">${await Translate(favorite.name)}</span></span>`;
		}
		const result = `<div class="sidebar-nav-item ${sidebar?.hideSection?.favorites ? 'nav-hide-item' : ''}">
        <div class="sidebar-hover-effect">
            <span class="sidebar-nav-item-dropdown-btn" data-section="favorites"><img src="${await fileThumbnail(
				'Favorites',
				'sidebar',
				false
			)}" alt="Favorites icon"><span class="sidebar-text">${await Translate(
			'Favorites'
		)}</span><div class="sidebar-nav-item-dropdown-spacer"></div></span>
        </div>
        <div class="sidebar-nav-item-dropdown-container">
            ${favoritesElement}
        </div>
        </div>`;
		return result;
	};

	const favorites = await Storage.get('favorites');
	const _favorites = IsValid(favorites?.favorites)
		? favorites.favorites
		: [
				{ name: 'Home', path: 'xplorer://Home' },
				{ name: 'Recent', path: 'xplorer://Recent' },
				{ name: 'Desktop', path: FavoritesData.DESKTOP_PATH },
				{ name: 'Documents', path: FavoritesData.DOCUMENT_PATH },
				{ name: 'Downloads', path: FavoritesData.DOWNLOAD_PATH },
				{ name: 'Pictures', path: FavoritesData.PICTURE_PATH },
				{ name: 'Music', path: FavoritesData.MUSIC_PATH },
				{ name: 'Videos', path: FavoritesData.VIDEO_PATH },
				{ name: 'Trash', path: 'xplorer://Trash' }, // eslint-disable-next-line no-mixed-spaces-and-tabs
		  ];
	// get drives element
	const sidebarNavElement = document.querySelector('#sidebar-nav') as HTMLDivElement;
	sidebarNavElement.innerHTML = `
			${await getFavoritesElement(_favorites)}
			${await sidebarDrivesElement()}
		`;

	const sidebarElement = document.querySelector('.sidebar') as HTMLDivElement;

	const settingBtn = document.querySelector('.sidebar-setting-btn');
	settingBtn.innerHTML = `
		<div class="sidebar-setting-btn-inner">
			<img src="${await fileThumbnail('setting', 'sidebar', false)}" alt="Setting icon" class="sidebar-setting-btn-icon" />

			<span class="sidebar-setting-btn-text">
				${await Translate('Settings')}
			</span>
		</div>`;

	// Collapse section
	sidebarElement.querySelectorAll('.sidebar-nav-item-dropdown-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			let sidebarNavItem = (e.target as Element).parentNode;
			while (!(sidebarNavItem as HTMLElement).classList.contains('sidebar-nav-item')) {
				sidebarNavItem = sidebarNavItem.parentNode;
			}
			(sidebarNavItem as HTMLElement).classList.toggle('nav-hide-item');

			// Save preference into local storage
			const sidebar = await Storage.get('sidebar');
			if (!sidebar?.hideSection) sidebar.hideSection = {}; // Initialize if it's not exist
			sidebar.hideSection[(sidebarNavItem as HTMLElement).querySelector<HTMLElement>('[data-section]').dataset.section] = (
				sidebarNavItem as HTMLElement
			).classList.contains('nav-hide-item');
			Storage.set('sidebar', sidebar);
		});
	});
	changeSidebar(sidebarElement);
};

export default createSidebar;
