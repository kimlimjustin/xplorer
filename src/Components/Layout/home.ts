import os from 'os';
import path from 'path';
import {
	Drives,
	getDrives,
	getUniqueDrives,
	drivesToElements,
	uniqueDrives,
} from '../Drives/drives';
import Favorites from '../Favorites/favorites';
import { updateTheme } from '../Theme/theme';
import fs from 'fs';
import Translate from '../I18n/i18n';
import nativeDrag from '../Files/File Operation/drag';
import fileIcon from '../Files/File Icon/fileIcon';
import { startLoading, stopLoading } from '../Functions/Loading/loading';
import storage from 'electron-json-storage-sync';
import LAZY_LOAD from '../Functions/lazyLoadingImage';
import { createContextMenus } from '../ContextMenu/contextMenu';
import { isHiddenFile } from 'is-hidden-file';
import getType from '../Files/File Type/type';
import formatBytes from '../Functions/filesize';
import windowGUID from '../Constants/windowGUID';
import type fileData from '../../Typings/fileData';

/**
 * Create home files section (only for linux)
 * @param {any} callback
 * @returns {any} home file section
 */
type cb = (res: string) => void;
const homeFiles = (callback: cb) => {
	const readHomeFiles = async () => {
		const dirAlongsideFiles =
			storage.get('preference')?.data?.dirAlongsideFiles ?? false;
		const layout =
			storage.get('layout')?.data?.[os.homedir()] ??
			storage.get('preference')?.data?.layout ??
			's';
		const sort = storage.get('sort')?.data?.[os.homedir()] ?? 'A';
		let result = `<section class='home-section'><h1 class="section-title">Files</h1>`;
		let files = fs
			.readdirSync(os.homedir(), { withFileTypes: true })
			.map((dirent) => {
				const result: fileData = {
					name: dirent.name,
					isDir: dirent.isDirectory(),
					isHidden: isHiddenFile(
						path.join(os.homedir(), dirent.name)
					),
				};
				const type = dirent.isDirectory()
					? 'File Folder'
					: getType(path.join(os.homedir(), dirent.name));
				result.type = type;
				const stat = fs.statSync(path.join(os.homedir(), dirent.name));
				result.createdAt = stat.ctime;
				result.modifiedAt = stat.mtime;
				result.accessedAt = stat.atime;
				result.size = stat.size;
				return result;
			});
		files = files.sort((a, b) => {
			switch (sort) {
				case 'A': // A-Z
					return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
				case 'Z': // Z-A
					return a.name.toLowerCase() < b.name.toLowerCase() ? 1 : -1;
				case 'L': // Last Modified
					return new Date(a.modifiedAt) < new Date(b.modifiedAt)
						? 1
						: -1;
				case 'F': // First Modified
					return new Date(a.modifiedAt) > new Date(b.modifiedAt)
						? 1
						: -1;
				case 'S': // Size
					return a.size > b.size ? 1 : -1;
				case 'T':
					return a.type > b.type ? 1 : -1;
			}
		});
		if (!dirAlongsideFiles) {
			files = files.sort((a, b) => -(Number(a.isDir) - Number(b.isDir)));
		}
		await files.forEach(async (file) => {
			const preview = await fileIcon(
				path.join(os.homedir(), file.name),
				file.isDir ? 'folder' : 'file'
			);
			let className = 'file file-grid grid-hover-effect';
			switch (layout) {
				case 'm':
					className += ' medium-grid-view';
					break;
				case 'l':
					className += ' large-grid-view';
					break;
				case 'd':
					className += ' detail-view';
					break;
				default:
					className += ' small-grid-view';
					break;
			}
			result += `<div class="${className}" draggable="true" data-isdir=${
				file.isDir
			} data-path = "${escape(
				path.join(os.homedir(), file.name)
			)}" data-listenOpen ${
				isHiddenFile(path.join(os.homedir(), file.name))
					? 'data-hidden-file'
					: ''
			} data-tilt data-size="${file.size}" data-created-at="${
				file.createdAt
			}" data-modified-at="${file.modifiedAt}" data-accessed-at="${
				file.accessedAt
			}">
            ${preview}
            <span class="file-grid-filename" id="file-filename">${Translate(
				file.name
			)}</span><span class="file-modifiedAt" id="file-createdAt">${new Date(
				file.modifiedAt
			).toLocaleString(navigator.language, { hour12: false })}</span>
            ${
				file.size > 0
					? `<span class="file-size" id="file-size">${formatBytes(
							file.size
					  )}</span>` //eslint-disable-line
					: `<span class="file-size" id="file-size"></span>` //eslint-disable-line
			}
            </div>`;
		});
		callback(result + '</section>');
	};
	readHomeFiles();

	// Watch the directory
	const watcher = fs.watch(os.homedir(), async () => {
		readHomeFiles();
	});

	let focusingPath: string; // Watch if focusing path changes
	setInterval(() => {
		const tabs = storage.get(`tabs-${windowGUID}`)?.data;
		const _focusingPath = tabs.tabs[tabs.focus]?.position;
		if (focusingPath === undefined) {
			focusingPath = _focusingPath;
		} else {
			if (focusingPath !== _focusingPath) {
				watcher.close();
			}
		}
	}, 500);
};

type homecb = () => void;

/**
 * Create contents for home page
 * @param {homecb} _callback - callback argument
 * @returns {Promise<void>}
 */
const Home = async (_callback: homecb): Promise<void> => {
	startLoading();
	// Get the main element
	const MAIN_ELEMENT = document.getElementById('workspace');
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification'))
		MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist
	const favorites = Favorites();
	const drives = await Drives();
	if (process.platform !== 'win32') {
		homeFiles((files) => {
			// Update the content in the main page ...
			MAIN_ELEMENT.innerHTML = favorites + drives + files;

			createContextMenus(document.querySelectorAll('.file'));
			// And also the theme :)
			updateTheme();
			nativeDrag(document.querySelectorAll('.file'), os.homedir()); // Listen to native drag
			_callback();
			stopLoading();
			LAZY_LOAD();
		});
	} else {
		// Update the content in the main page ...
		MAIN_ELEMENT.innerHTML = favorites + drives;
		// And also the theme :)
		updateTheme();
		_callback();
		stopLoading();
	}
	let previousDrive: uniqueDrives[];
	// Function to listen changes of drives
	const listenDrives = setInterval(async () => {
		const _drives = await getDrives();
		const _uniqueDrive = getUniqueDrives(_drives);
		if (previousDrive === undefined) {
			previousDrive = _uniqueDrive;
		} else {
			if (
				JSON.stringify(_uniqueDrive) !== JSON.stringify(previousDrive)
			) {
				if (
					document
						.getElementById('drives')
						.classList.contains('hidden')
				)
					document
						.getElementById('drives')
						.classList.remove('hidden');
				document.getElementById('drives').innerHTML =
					drivesToElements(_drives);
				updateTheme();
			}
		}
		const tabs = storage.get(`tabs-${windowGUID}`)?.data;
		const focusingPath = tabs.tabs[tabs.focus]?.position;
		if (focusingPath !== 'xplorer://Home') {
			clearInterval(listenDrives);
		}
		previousDrive = _uniqueDrive;
	}, 500);
};

export default Home;
