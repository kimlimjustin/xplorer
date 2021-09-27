import fs from 'fs';
import storage from 'electron-json-storage-sync';
import fileIcon from '../Files/File Icon/fileIcon';
import { getDrives } from '../Drives/drives';
import getDriveBasePath from '../Functions/basePath';
import { updateTheme } from '../Theme/theme';
import Translate from '../I18n/i18n';
import Setting from '../Setting/setting';
import { default as getPath } from 'platform-folders';

interface Favorites {
	name: string;
	path: string;
}

const changeSidebar = (newElement: HTMLElement) => {
	const { listenOpen } = require('../Files/File Operation/open'); //eslint-disable-line
	const sidebarElement = document.body.querySelector('.sidebar');
	sidebarElement.parentElement.replaceChild(newElement, sidebarElement);
	updateTheme();
	listenOpen(
		document
			.querySelector('.sidebar-nav')
			.querySelectorAll('[data-listenOpen]')
	); // Listen to open the file
	return;
};

/**
 * Sidebar initializer function
 * @returns {void}
 */
const createSidebar = (): void => {
	const { ContextMenu } = require('../ContextMenu/contextMenu'); //eslint-disable-line
	const { data } = storage.get('sidebar'); // Get user favorites data on sidebar
	// Functions to get favorites element
	const getFavoritesElement = (favorites: Favorites[]) => {
		let favoritesElement = '';
		const sidebarElementFavorites = [
			'Home',
			'Recent',
			'Documents',
			'Desktop',
			'Downloads',
			'Pictures',
			'Music',
			'Videos',
			'Trash',
		];
		for (const favorite of favorites) {
			let isdir;
			try {
				isdir = fs.lstatSync(favorite.path).isDirectory();
			} catch (_) {
				isdir = true;
			}
			favoritesElement += `<span data-listenOpen data-path = "${
				favorite.path
			}" data-isdir="${isdir}" class="sidebar-hover-effect sidebar-item"><img src="${fileIcon(
				favorite.name,
				sidebarElementFavorites.indexOf(favorite.name) === -1
					? isdir
						? 'folder'
						: 'file'
					: 'sidebar',
				false
			)}" alt="${
				favorite.name
			} icon"><span class="sidebar-text">${Translate(
				favorite.name
			)}</span></span>`;
		}
		const result = `<div class="sidebar-nav-item ${
			data?.hideSection?.favorites ? 'nav-hide-item' : ''
		}">
        <div class="sidebar-hover-effect">
            <span class="sidebar-nav-item-dropdown-btn" data-section="favorites"><img src="${fileIcon(
				'Favorites',
				'sidebar',
				false
			)}" alt="Favorites icon"><span class="sidebar-text">${Translate(
			'Favorites'
		)}</span><div class="sidebar-nav-item-dropdown-spacer"></div></span>
        </div>
        <div class="sidebar-nav-item-dropdown-container">
            ${favoritesElement}
        </div>
        </div>`;
		return result;
	};

	// Functions to get and display drives on sidebar
	const getDrivesElement = async () => {
		const drives = await getDrives();
		if (!drives.length || process.platform === 'darwin')
			return `<div class="sidebar-nav-item" id="sidebar-drives"></div>`;
		// Return basic sidebar item element if there's no drives detected or its running on macOS
		else {
			let drivesElement = '';
			for (const drive of drives) {
				//prettier-ignore
				const driveName = process.platform === 'win32'
				//prettier-ignore
					? `${drive.volumename || drive.filesystem} (${drive.mounted})`
				//prettier-ignore
					: drive.mounted.split('/')[drive.mounted.split('/').length - 1]; // Get name of drive
				drivesElement += `<span data-listenOpen data-path = "${getDriveBasePath(
					drive.mounted
				)}" data-isdir="true" class="sidebar-hover-effect drive-item"><img src="${fileIcon(
					drive.filesystem === 'Removable Disk' ? 'usb' : 'hard-disk',
					'favorites',
					false
				)}" alt="${driveName}"><span class="sidebar-text">${driveName}</span></span>`;
			}
			const result = `<div class="sidebar-nav-item sidebar-nav-drives ${
				data?.hideSection?.drives ? 'nav-hide-item' : ''
			}" id="sidebar-drives">
                <div class="sidebar-hover-effect">
                <span class="sidebar-nav-item-dropdown-btn" data-section="drives"><img src="${fileIcon(
					'hard-disk',
					'favorites',
					false
				)}" alt="Drives icon"><span class="sidebar-text">${
				process.platform === 'win32'
					? Translate('Drives')
					: Translate('Pendrives')
			}</span><div class="sidebar-nav-item-dropdown-spacer"></div></span>
                </div>
                <div class="sidebar-nav-item-dropdown-container">
                    ${drivesElement}
                </div>
            </div>`;
			return result;
		}
	};

	const _favorites = data?.favorites ?? [
		{ name: 'Home', path: 'xplorer://Home' },
		{ name: 'Recent', path: 'xplorer://Recent' },
		{ name: 'Desktop', path: `${getPath('desktop')}` },
		{ name: 'Documents', path: `${getPath('documents')}` },
		{ name: 'Downloads', path: `${getPath('downloads')}` },
		{ name: 'Pictures', path: `${getPath('pictures')}` },
		{ name: 'Music', path: `${getPath('music')}` },
		{ name: 'Videos', path: `${getPath('videos')}` },
		{ name: 'Trash', path: 'xplorer://Trash' },
	];

	getDrivesElement().then((drivesElement) => {
		// get drives element
		const sidebarElement = document.createElement('div');
		sidebarElement.classList.add('sidebar');
		sidebarElement.innerHTML = `
        <span class="xplorer-brand">Xplorer</span>
        <div class="sidebar-nav">
            ${getFavoritesElement(_favorites)}
            ${drivesElement}
        </div>
        <div class="sidebar-setting-btn sidebar-hover-effect">
            <div class="sidebar-setting-btn-inner">
                <img src="${fileIcon(
					'setting',
					'sidebar',
					false
				)}" alt="Setting icon" class="sidebar-setting-btn-icon">
                <span class="sidebar-setting-btn-text">${Translate(
					'Settings'
				)}</span>
            </div>
        </div>`;

		// Collapse section
		sidebarElement
			.querySelectorAll('.sidebar-nav-item-dropdown-btn')
			.forEach((btn) => {
				btn.addEventListener('click', (e) => {
					(
						(e.target as Element).parentNode
							.parentNode as HTMLElement
					).classList.toggle('nav-hide-item');

					// Save preference into local storage
					const sidebar = storage.get('sidebar')?.data ?? {};
					if (!sidebar.hideSection) sidebar.hideSection = {}; // Initialize if it's not exist
					sidebar.hideSection[
						(e.target as HTMLElement).dataset.section
					] = (
						(e.target as Element).parentNode
							.parentNode as HTMLElement
					).classList.contains('nav-hide-item');
					storage.set('sidebar', sidebar);
				});
			});
		changeSidebar(sidebarElement);
		document.body
			.querySelector('.sidebar')
			.querySelectorAll('.sidebar-item')
			.forEach((item) => {
				ContextMenu(item);
			});
		document.body
			.querySelector('.sidebar')
			.querySelectorAll('.drive-item')
			.forEach((item) => {
				ContextMenu(item);
			});
		Setting();
	});
	let _prevDrives: undefined | string;
	setInterval(() => {
		getDrivesElement().then((_drives) => {
			if (_prevDrives === undefined) _prevDrives = _drives;
			else {
				if (_drives !== _prevDrives) {
					const {
						listenOpen,
					} = require('../Files/File Operation/open'); //eslint-disable-line
					const _newElement = document.createElement('div');
					_newElement.innerHTML = _drives.trim();
					document
						.getElementById('sidebar-drives')
						.parentNode.replaceChild(
							_newElement.firstChild,
							document.getElementById('sidebar-drives')
						);
					updateTheme();
					listenOpen(
						document
							.getElementById('sidebar-drives')
							.querySelectorAll('[data-listenOpen]')
					);
					document.body
						.querySelector('.sidebar')
						.querySelectorAll('.drive-item')
						.forEach((item) => {
							ContextMenu(item);
						});
				}
				_prevDrives = _drives;
			}
		});
	}, 500);
	return;
};

export default createSidebar;
