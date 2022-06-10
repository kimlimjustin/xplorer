import DirectoryAPI from '../../Service/directory';
import { startLoading, stopLoading, isLoading } from '../Functions/Loading/loading';
import { updateTheme } from '../Theme/theme';
import FileAPI from '../../Service/files';
import changePosition from '../Functions/changePosition';
import Recent from './recent';
import Home from '../Layout/home';
import displayFiles from './displayFiles';
import { InfoLog, OpenLog } from '../Functions/log';
import getDirname from '../Functions/path/dirname';
import normalizeSlash from '../Functions/path/normalizeSlash';
import { changeWindowTitle } from '../../Service/window';
import getBasename from '../Functions/path/basename';
import { getTrashedFiles } from '../../Service/trash';
import OS from '../../Service/platform';
import { reload } from '../Layout/windowManager';
import focusingPath from '../Functions/focusingPath';
import { LOAD_IMAGE } from '../Functions/lazyLoadingImage';
import PromptError from '../Prompt/error';
import { UpdateInfo } from '../Layout/infobar';
import { processSearch, stopSearchingProcess } from '../Files/File Operation/search';
import Storage from '../../Service/storage';
import { GET_TAB_ELEMENT, MAIN_BOX_ELEMENT } from '../../Util/constants';
import Error from '../Prompt/error';
let platform: string;
let directoryInfo: DirectoryAPI;
/**
 * Open a directory on Xplorer
 * @param {string} dir - Dir path to open
 * @param {boolean} reveal - Open the parent directory and select the file/dir
 * @param {forceOpen} boolean - Force open the directory without checking if it's focusing path
 * @param {boolean} writeHistory - Write open directory history to storage
 * @returns {Promise<void>}
 */
const OpenDir = async (dir: string, reveal?: boolean, forceOpen = false, writeHistory = true): Promise<void> => {
	await stopSearchingProcess();
	if (isLoading() && !forceOpen) {
		InfoLog(`Something is still loading, refusing to open dir ${dir}`);
		return;
	}
	// Check if the user is just want to reload the current directory
	const isReload = (await focusingPath()) === dir && !forceOpen;
	if (!isReload) directoryInfo?.unlisten?.();
	startLoading();
	changePosition(dir, forceOpen, writeHistory);
	const MAIN_ELEMENT = GET_TAB_ELEMENT();
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('error-reading-files')) MAIN_ELEMENT.classList.remove('error-reading-files'); // Remove class if exist
	if (dir === 'xplorer://Home') {
		Home();
		UpdateInfo('number-of-files', '');
		OpenLog(dir);
	} else if (dir === 'xplorer://Trash') {
		if (!platform) platform = await OS();
		if (platform === 'darwin') {
			MAIN_ELEMENT.classList.add('error-reading-files');
			MAIN_ELEMENT.innerText = 'Xploring trash folder is not supported for macOS yet.';
			stopLoading();
		} else {
			getTrashedFiles().then(async (trashedFiles) => {
				UpdateInfo('number-of-files', `${trashedFiles.files.length} files`);
				if (!trashedFiles.files.length) {
					MAIN_ELEMENT.classList.add('error-reading-files');
					MAIN_ELEMENT.innerText = 'This folder is empty.';
					stopLoading();
				} else {
					await displayFiles(trashedFiles.files, dir, MAIN_ELEMENT);
					stopLoading();
					updateTheme('grid');
					LOAD_IMAGE();
					changeWindowTitle(getBasename(dir));
				}
			});
		}
		OpenLog(dir);
	} else if (dir === 'xplorer://Recent') {
		Recent();
		UpdateInfo('number-of-files', '');
		OpenLog(dir);
	} else if (dir.startsWith('Search')) {
		// Search path pattern: Search: [[search-query]] inside [[search-path]]
		const splitBySearchKeyword = dir.split('Search: ');
		splitBySearchKeyword.shift();
		const query = splitBySearchKeyword.join('Search: ');
		const splitByInsideKeyword = query.split(' inside ');
		if (splitByInsideKeyword.length === 2) {
			const searchQuery = splitByInsideKeyword[0].slice(2, -2);
			const searchPath = splitByInsideKeyword[1].slice(2, -2);
			processSearch(searchQuery, searchPath);
		} else {
			for (let i = 0; i < splitByInsideKeyword.length; i++) {
				if (splitByInsideKeyword[i]?.endsWith(']]') && splitByInsideKeyword[i + 1]?.startsWith('[[')) {
					const searchQuery = splitByInsideKeyword
						.slice(0, i + 1)
						.join(' inside ')
						.slice(2, -2);
					const searchPath = splitByInsideKeyword
						.slice(i + 1)
						.join(' inside ')
						.slice(2, -2);
					processSearch(searchQuery, searchPath);
				}
			}
		}
	} else {
		if (reveal) {
			directoryInfo = new DirectoryAPI(getDirname(dir));
			if (!(await directoryInfo.exists())) {
				PromptError('Directory not exists', "Directory you're looking for does not exist.");
				stopLoading();
				return;
			}
			await directoryInfo
				.getFiles()
				.then(async (files) => {
					UpdateInfo('number-of-files', `${files.number_of_files - files.skipped_files.length} files`);
					if (!files.files.length) {
						MAIN_ELEMENT.classList.add('error-reading-files');
						MAIN_ELEMENT.innerText = 'This folder is empty.';
						stopLoading();
					} else {
						await displayFiles(
							files.files,
							dir,
							MAIN_ELEMENT,
							{
								reveal,
								revealDir: normalizeSlash(dir),
							},
							null,
							files.lnk_files
						);
						stopLoading();
						updateTheme('grid');
						LOAD_IMAGE();
						changeWindowTitle(getBasename(getDirname(dir)));
						console.timeEnd(dir);
						if (!isReload) directoryInfo.listen(() => reload());
					}
				})
				.catch((err) => {
					MAIN_ELEMENT.classList.add('error-reading-files');
					MAIN_ELEMENT.innerText = err;
					stopLoading();
				});
		} else {
			directoryInfo = new DirectoryAPI(dir);
			if (!(await directoryInfo.exists())) {
				PromptError('Directory not exists', "Directory you're looking for does not exist.");
				stopLoading();
				return;
			}
			await directoryInfo
				.getFiles()
				.then(async (files) => {
					UpdateInfo('number-of-files', `${files.number_of_files - files.skipped_files.length} files`);
					if (!files.files.length) {
						MAIN_ELEMENT.classList.add('error-reading-files');
						MAIN_ELEMENT.innerText = 'This folder is empty.';
						stopLoading();
					} else {
						await displayFiles(files.files, dir, MAIN_ELEMENT, null, null, files.lnk_files);
						stopLoading();
						updateTheme('grid');
						LOAD_IMAGE();
						changeWindowTitle(getBasename(dir));
						if (!isReload) directoryInfo.listen(() => reload());
						console.timeEnd(dir);
						return;
					}
				})
				.catch((err) => {
					MAIN_ELEMENT.classList.add('error-reading-files');
					MAIN_ELEMENT.innerText = err;
					stopLoading();
				});
		}
		OpenLog(dir);
	}
};
/**
 * Open file/folder handler
 * @param {any} e - event
 * @returns {Promise<void>}
 */
const OpenHandler = async (e: MouseEvent): Promise<void> => {
	const preference = await Storage.get('preference');
	if (document.querySelector('#sidebar-nav').contains(e.target as HTMLElement)) {
		if (e.detail === 1 && preference?.clickToOpenSidebar && preference?.clickToOpenSidebar !== 'single') return;
	} else if ((await focusingPath()) === 'xplorer://Home') {
		if (e.detail === 1 && preference?.clickToOpenHome !== 'single') return;
	} else {
		if (e.detail === 1 && preference?.clickToOpenHome !== 'single') return;
	}
	let element = e.target as HTMLElement;
	while (element?.dataset && !element.dataset.path) {
		element = element.parentNode as HTMLElement;
	}
	if (!element?.dataset?.path) return;
	if (element.classList.contains('workspace-tab')) return;

	const filePath = decodeURI(element.dataset.path);

	if ((await focusingPath()) === 'xplorer://Trash' && element.dataset.isdir !== 'true') {
		Error('Error opening trashed file', 'Please restore the file first in order to open it.');
	}

	// Open the file if it's not directory
	if (element.dataset.isdir !== 'true') {
		OpenLog(filePath);
		await new FileAPI(filePath).openFile();
	} else {
		OpenDir(filePath);
	}
};
/**
 * Open directory/file listener initializer
 * @returns {Promise<void>}
 */
const OpenInit = async (): Promise<void> => {
	document.querySelector('#sidebar-nav').addEventListener('click', OpenHandler);
	MAIN_BOX_ELEMENT().addEventListener('click', OpenHandler);
};
export { OpenInit, OpenDir };
