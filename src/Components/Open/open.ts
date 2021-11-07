import DirectoryAPI from '../../Api/directory';
import { startLoading, stopLoading } from '../Functions/Loading/loading';
import { updateTheme } from '../Theme/theme';
import LAZY_LOAD from '../Functions/lazyLoadingImage';
import FileAPI from '../../Api/files';
import changePosition from '../Functions/changePosition';
import Recent from './recent';
import Home from '../Layout/home';
import displayFiles from './displayFiles';
import { OpenLog } from '../Functions/log';
import getDirname from '../Functions/path/dirname';
import normalizeSlash from '../Functions/path/normalizeSlash';
import { changeWindowTitle } from '../../Api/window';
import getBasename from '../Functions/path/basename';
import { getTrashedFiles } from '../../Api/trash';
import OS from '../../Api/platform';
import { reload } from '../Layout/windowManager';
let platform: string;
/**
 * Open a directory on Xplorer
 * @param {string} dir - Dir path to open
 * @param {boolean} reveal - Open the parent directory and select the file/dir
 * @returns {Promise<void>}
 */
const OpenDir = async (dir: string, reveal?: boolean): Promise<void> => {
	startLoading();
	changePosition(dir);
	const MAIN_ELEMENT = document.getElementById('workspace');
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist

	if (dir === 'xplorer://Home') {
		Home();
	} else if (dir === 'xplorer://Trash') {
		if (!platform) platform = await OS();
		if (platform === 'darwin') {
			MAIN_ELEMENT.classList.add('empty-dir-notification');
			MAIN_ELEMENT.innerText = 'Xploring trash folder is not supported for macOS yet.';
			stopLoading();
		} else {
			getTrashedFiles().then(async (trashedFiles) => {
				if (!trashedFiles.files.length) {
					MAIN_ELEMENT.classList.add('empty-dir-notification');
					MAIN_ELEMENT.innerText = 'This folder is empty.';
					stopLoading();
				} else {
					await displayFiles(trashedFiles.files, dir, MAIN_ELEMENT);
					stopLoading();
					updateTheme();
					LAZY_LOAD();
					changeWindowTitle(getBasename(dir));
				}
			});
		}
	} else if (dir === 'xplorer://Recent') {
		Recent();
	} else {
		if (reveal) {
			const directoryInfo = new DirectoryAPI(getDirname(dir));
			directoryInfo.getFiles().then(async (files) => {
				if (!files.files.length) {
					MAIN_ELEMENT.classList.add('empty-dir-notification');
					MAIN_ELEMENT.innerText = 'This folder is empty.';
					stopLoading();
				} else {
					await displayFiles(files.files, dir, MAIN_ELEMENT, {
						reveal,
						revealDir: normalizeSlash(dir),
					});
					stopLoading();
					updateTheme();
					LAZY_LOAD();
					changeWindowTitle(getBasename(getDirname(dir)));
				}
			});
		} else {
			const directoryInfo = new DirectoryAPI(dir);
			directoryInfo.getFiles().then(async (files) => {
				if (!files.files.length) {
					MAIN_ELEMENT.classList.add('empty-dir-notification');
					MAIN_ELEMENT.innerText = 'This folder is empty.';
					stopLoading();
				} else {
					await displayFiles(files.files, dir, MAIN_ELEMENT);
					stopLoading();
					updateTheme();
					LAZY_LOAD();
					changeWindowTitle(getBasename(dir));
					directoryInfo.listen(() => reload());
				}
			});
		}
	}
};
/**
 * Open file/folder handler
 * @param {any} e - event
 * @returns {void}
 */
const OpenHandler = (e: Event): void => {
	let element = e.target as HTMLElement;
	while (!element.dataset.path) {
		element = element.parentNode as HTMLElement;
	}
	if (element.id === 'workspace') return;

	const filePath = unescape(element.dataset.path);

	// Open the file if it's not directory
	if (element.dataset.isdir !== 'true') {
		OpenLog(filePath);
		new FileAPI(filePath).openFile();
	} else {
		OpenDir(filePath);
	}
};
/**
 * Open directory/file listener initializer
 * @returns {void}
 */
const OpenInit = (): void => {
	document.querySelector('#sidebar-nav').addEventListener('click', OpenHandler);
	document.querySelector('#workspace').addEventListener('dblclick', OpenHandler);
};
export { OpenInit, OpenDir };
