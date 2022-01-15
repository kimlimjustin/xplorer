import { createNewTab, goBack, goForward } from '../Layout/tab';
import focusingPath from '../Functions/focusingPath';
import { OpenDir } from '../Open/open';
import getDirname from '../Functions/path/dirname';
import copyLocation from '../Files/File Operation/location';
import { ChangeSelectedEvent, getSelected, Select, unselectAllSelected } from '../Files/File Operation/select';
import Pin from '../Files/File Operation/pin';
import New from '../Functions/new';
import { createNewWindow } from '../../Service/window';
import Storage from '../../Service/storage';
import windowName from '../../Service/window';
import FileAPI from '../../Service/files';
import DirectoryAPI from '../../Service/directory';
import reveal from '../../Service/reveal';
import NormalizeSlash from '../Functions/path/normalizeSlash';
import { reload } from '../Layout/windowManager';
import Cut from '../Files/File Operation/cut';
import Copy from '../Files/File Operation/copy';
import Paste from '../Files/File Operation/paste';
import toggleHiddenFiles from '../Functions/toggleHiddenFiles';
import Rename from '../Files/File Operation/rename';
import Undo from '../Files/File Operation/undo';
import Redo from '../Files/File Operation/redo';
import { Trash, PermanentDelete, Purge } from '../Files/File Operation/trash';
import Properties from '../Properties/properties';
import Preview, { closePreviewFile } from '../Files/File Preview/preview';
import { ensureElementInViewPort } from '../Functions/viewport';
import OperationAPI from '../../Api/operation';
let selectedAll = true;
let pauseEnterListener = false;
/**
 * Get if currently selecting all files
 * @returns {boolean} currently selecting all files
 */
const getSelectedAllStatus = (): boolean => selectedAll;
/**
 * Change selected all status
 * @returns {void}
 */
const changeSelectedAllStatus = (): void => {
	selectedAll = false;
};

const pauseEnter = (): void => {
	pauseEnterListener = true;
};

/**
 * Initialize shortcut keys
 * @returns {void}
 */
const Shortcut = (): void => {
	let searchingFileName = '';
	let _searchListener: ReturnType<typeof setTimeout>;
	const KeyUpShortcutsHandler = async (e: KeyboardEvent) => {
		const selectedFile = getSelected()?.[0];
		const selectedFilePath = unescape(selectedFile?.dataset?.path);
		const isDir = selectedFile?.dataset.isdir === 'true';
		const _focusingPath = await focusingPath();

		// Don't react if cursor is over input field
		if (document.activeElement.tagName === 'INPUT') return;

		// Open file shorcut (Enter)
		if (e.key === 'Enter') {
			for (const selected of getSelected()) {
				const targetPath = unescape(selected.dataset.path) === 'undefined' ? _focusingPath : unescape(selected.dataset.path);
				if ((await new DirectoryAPI(targetPath).exists()) && !pauseEnterListener) {
					// Open file in vscode (Shift + Enter)
					if (e.shiftKey) {
						reveal(targetPath, 'vscode');
					} else {
						if (isDir) {
							OpenDir(targetPath);
						} else {
							new FileAPI(targetPath).openFile();
						}
					}
				} else pauseEnterListener = false;
			}
		}
		// Collapse sidebar (Ctrl + B)
		if (e.ctrlKey && e.key === 'b') {
			const sidebar = document.querySelector<HTMLElement>('.sidebar');
			const xplorerBrand = document.querySelector<HTMLElement>('.xplorer-brand');
			const appearance = await Storage.get('appearance');
			let size: string;
			if (getComputedStyle(sidebar).width === '70px') {
				sidebar.classList.remove('sidebar-minimized');
				xplorerBrand.innerHTML = 'Xplorer';
				size = appearance.expandedSidebarWidth;
			} else {
				xplorerBrand.innerHTML = `<img src=${require('../../Icon/extension/xplorer.svg')} alt="xplorer" />`;
				sidebar.classList.add('sidebar-minimized');
				size = '70px';
			}
			appearance.sidebarWidth = size;
			sidebar.style.flexBasis = size;
			Storage.set('appearance', appearance);
		}
		// Duplicate file (Ctrl + D)
		if (e.ctrlKey && e.key === 'd') {
			console.log('a');
			new OperationAPI(selectedFilePath).duplicate();
		}
		// New tab shortcut (Ctrl + T)
		else if (e.key === 't' && e.ctrlKey) {
			createNewTab();
		}
		// New window shortcut (Ctrl + N)
		else if (e.key === 'n' && e.ctrlKey) {
			createNewWindow();
		}
		// New file shortcut (Alt + N)
		else if (e.key === 'n' && e.altKey && !e.shiftKey) {
			New('file');
		}
		// New folder shortcut (Shift + N)
		else if (e.key === 'N' && !e.altKey && e.shiftKey) {
			New('folder');
		}

		// Open in terminal shortcut (Alt + T)
		else if (e.altKey && e.key === 't') {
			const _to_reveal = NormalizeSlash(selectedFilePath && selectedFilePath !== 'undefined' ? selectedFilePath : _focusingPath);
			if (_to_reveal.startsWith('xplorer://')) return;
			reveal(_to_reveal, 'terminal');
		}
		// Pin to sidebar shortcut (Alt+P)
		else if (e.altKey && e.key === 'p') {
			let filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			if (!filePaths.length) filePaths = [_focusingPath];
			Pin(filePaths);
		}

		// Copy file shortcut (Ctrl + C)
		else if (e.ctrlKey && e.key === 'c') {
			const filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			Copy(filePaths);
		}

		// Toggle hidden files shortcut (Ctrl+H)
		else if (e.ctrlKey && e.key === 'h') {
			toggleHiddenFiles();
		}
		// Open file in preview shortcut (Ctrl+O)
		else if (e.ctrlKey && e.key === 'o') {
			if (document.querySelectorAll('.preview').length > 0) {
				closePreviewFile();
			} else Preview(selectedFilePath);
		}

		// Exit tab shortcut (Ctrl + W)
		else if (e.ctrlKey && e.key === 'w') {
			const tabs = await Storage.get(`tabs-${windowName}`);

			if (document.querySelectorAll('.tab').length === 1) {
				close();
			} else {
				const tab = document.getElementById(`tab${tabs.focus}`);
				tab.parentElement.removeChild(tab);
				tabs.focusHistory = tabs.focusHistory.filter((tabIndex: number) => String(tabIndex) !== tabs.focus);
				delete tabs.tabs[tabs.focus];
				tabs.focus = String(tabs.focusHistory[tabs.focusHistory.length - 1]);
				Storage.set(`tabs-${windowName}`, tabs);
				OpenDir(tabs.tabs[tabs.focus].position);

				const tabsManager = document.querySelector('.tabs-manager');
				if (tabsManager.scrollWidth > tabsManager.clientWidth) tabsManager.removeAttribute('data-tauri-drag-region');
				else tabsManager.setAttribute('data-tauri-drag-region', '');
			}
		}
		// Copy file shortcut (Ctrl + V)
		else if (e.ctrlKey && e.key === 'v') {
			Paste(_focusingPath);
		}
		// Copy file shortcut (Ctrl + X)
		else if (e.ctrlKey && e.key === 'x') {
			const filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			Cut(filePaths);
		}
		// Undo file action (Ctrl+Z)
		else if (e.ctrlKey && e.key === 'z') {
			Undo();
		}
		// Redo file action (Ctrl+Shift+Z OR Ctrl+Y)
		else if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
			Redo();
		}
		// Previous tab shortcut (Alt+Arrow Left)
		else if (e.altKey && e.key === 'ArrowLeft') {
			goBack();
		}

		// Next tab shortcut (Alt+Arrow Right)
		else if (e.altKey && e.key === 'ArrowRight') {
			goForward();
		}

		// Go to parent directory (Alt + Arrow Up)
		else if (e.altKey && e.key === 'ArrowUp') {
			const _dirPath = getDirname(_focusingPath);
			if (!_focusingPath.startsWith('xplorer://') && _dirPath !== '.') OpenDir(_dirPath);
		}

		// Copy location path (Alt + Shift + C)
		else if (e.altKey && e.shiftKey && e.key === 'C') {
			copyLocation(selectedFile);
		}

		// Rename file shortcut (F2)
		else if (e.key === 'F2') {
			if (selectedFile) Rename(selectedFilePath);
		}
		// Delete file shortcut (Del)
		else if (e.key === 'Delete') {
			if (e.shiftKey) {
				const filePaths = [];
				for (const element of getSelected()) {
					filePaths.push(unescape(element.dataset.path));
				}
				if (_focusingPath === 'xplorer://Trash') Purge(filePaths);
				else PermanentDelete(filePaths);
			} else {
				if (_focusingPath === 'xplorer://Trash') return;
				const filePaths = [];
				for (const element of getSelected()) {
					filePaths.push(unescape(element.dataset.path));
				}
				Trash(filePaths);
			}
		} else if (e.keyCode >= 65 && e.keyCode <= 90) {
			// ignore some keys
			if (e.ctrlKey) return;
			clearInterval(_searchListener);
			if (e.key.toLowerCase() === searchingFileName.at(-1)) {
				const _files = [...document.querySelectorAll('.file')].filter((file: HTMLElement) => {
					return file
						.querySelector('#file-filename')
						.innerHTML.toLowerCase()
						.normalize('NFD')
						.replace(/[\u0300-\u036f]/g, '')
						.startsWith(searchingFileName);
				});
				for (let i = 0; i < _files.length; i++) {
					const _file = _files[i];
					if (_file.classList.contains('selected')) {
						unselectAllSelected();
						Select((_files[i + 1] ?? _files[0]) as HTMLElement, false, false);
						break;
					}
				}
			} else {
				searchingFileName += e.key.toLowerCase();

				const _files = document.querySelectorAll('.file');
				unselectAllSelected();
				for (const _file of _files) {
					const _fileName = _file.querySelector('#file-filename').innerHTML.toLowerCase();
					if (
						_fileName
							.normalize('NFD')
							.replace(/[\u0300-\u036f]/g, '')
							.startsWith(searchingFileName)
					) {
						Select(_file as HTMLElement, false, false);
						ensureElementInViewPort(_file as HTMLElement);
						ChangeSelectedEvent();
						break;
					}
				}
			}

			_searchListener = setInterval(() => {
				searchingFileName = '';
				clearInterval(_searchListener);
			}, 750);
		}
	};
	const KeyDownShortcutsHandler = async (e: KeyboardEvent) => {
		// Don't react if cursor is over input field
		if (document.activeElement.tagName === 'INPUT') return;
		// Select all shortcut (Ctrl + A)
		if (e.key === 'a' && e.ctrlKey) {
			e.preventDefault();
			selectedAll = !selectedAll;
			if (selectedAll) {
				document.querySelectorAll('.file').forEach((element) => element.classList.add('selected'));
			} else document.querySelectorAll('.file').forEach((element) => element.classList.remove('selected'));
			ChangeSelectedEvent();
		}

		// File properties (Ctrl+P)
		else if (e.ctrlKey && e.key === 'p') {
			e.preventDefault();
			const selectedFile = getSelected()?.[0];
			const selectedFilePath = unescape(selectedFile?.dataset?.path);
			Properties(selectedFilePath === 'undefined' ? await focusingPath() : selectedFilePath);
		}
		// Find files (Ctrl+F)
		else if (e.ctrlKey && e.key === 'f') {
			e.preventDefault();
			const searchElement = document.querySelector<HTMLInputElement>('.search-bar');
			searchElement.select();
			searchElement.focus();
		}
		// Internal Reload (F5)
		if (e.key === 'F5') {
			e.preventDefault();
			reload();
		}
	};

	const MouseShortcutsHandler = (e: MouseEvent) => {
		// Don't react if cursor is over input field
		if (document.activeElement.tagName === 'INPUT') return;

		switch (e.button) {
			// Back button
			case 3:
				goBack();
				break;
			// Forward button
			case 4:
				goForward();
				break;
		}
	};

	document.addEventListener('keyup', KeyUpShortcutsHandler);
	document.addEventListener('keydown', KeyDownShortcutsHandler);
	document.addEventListener('mouseup', MouseShortcutsHandler);

	window.addEventListener('beforeunload', () => {
		document.removeEventListener('keyup', KeyUpShortcutsHandler, false);
		document.removeEventListener('keydown', KeyDownShortcutsHandler, false);
		document.removeEventListener('mouseup', MouseShortcutsHandler);
	});
};
export { Shortcut, changeSelectedAllStatus, getSelectedAllStatus, pauseEnter };
