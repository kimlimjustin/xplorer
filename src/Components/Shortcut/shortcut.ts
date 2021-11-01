import { createNewTab, goBack, goForward } from '../Layout/tab';
import focusingPath from '../Functions/focusingPath';
import { OpenDir } from '../Open/open';
import getDirname from '../Functions/path/dirname';
import copyLocation from '../Files/File Operation/location';
import { getSelected } from '../Files/File Operation/select';
import Pin from '../Files/File Operation/pin';
import New from '../Functions/new';
import { createNewWindow } from '../../Api/window';
import Storage from '../../Api/storage';
import windowName from '../../Api/window';
import FileAPI from '../../Api/files';
import DirectoryAPI from '../../Api/directory';
import reveal from '../../Api/reveal';
import NormalizeSlash from '../Functions/path/normalizeSlash';
import { reload } from '../Layout/windowManager';
import Cut from '../Files/File Operation/cut';
import Copy from '../Files/File Operation/copy';
import Paste from '../Files/File Operation/paste';
import toggleHiddenFiles from '../Functions/toggleHiddenFiles';
import Rename from '../Files/File Operation/rename';

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
				const targetPath =
					unescape(selected.dataset.path) === 'undefined'
						? _focusingPath
						: unescape(selected.dataset.path);
				if (
					(await new DirectoryAPI(targetPath).exists()) &&
					!pauseEnterListener
				) {
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
		// New tab shortcut
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
			const _to_reveal = NormalizeSlash(
				selectedFilePath && selectedFilePath !== 'undefined'
					? selectedFilePath
					: _focusingPath
			);
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

		// Exit tab shortcut (Ctrl + W)
		else if (e.ctrlKey && e.key === 'w') {
			const tabs = await Storage.get(`tabs-${windowName}`);

			if (document.querySelectorAll('.tab').length === 1) {
				close();
			} else {
				const tab = document.getElementById(`tab${tabs.focus}`);
				tab.parentElement.removeChild(tab);
				tabs.focusHistory = tabs.focusHistory.filter(
					(tabIndex: number) => String(tabIndex) !== tabs.focus
				);
				delete tabs.tabs[tabs.focus];
				tabs.focus = String(
					tabs.focusHistory[tabs.focusHistory.length - 1]
				);
				console.log(tabs);
				Storage.set(`tabs-${windowName}`, tabs);
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
			if (!_focusingPath.startsWith('xplorer://') && _dirPath !== '.')
				OpenDir(_dirPath);
		}

		// Copy location path (Alt + Shift + C)
		else if (e.altKey && e.shiftKey && e.key === 'C') {
			copyLocation(selectedFile);
		}

		// Rename file shortcut (F2)
		else if (e.key === 'F2') {
			if (selectedFile) Rename(selectedFilePath);
		}
	};
	const KeyDownShortcutsHandler = (e: KeyboardEvent) => {
		// Don't react if cursor is over input field
		if (document.activeElement.tagName === 'INPUT') return;
		// Select all shortcut (Ctrl + A)
		if (e.key === 'a' && e.ctrlKey) {
			e.preventDefault();
			selectedAll = !selectedAll;
			if (selectedAll) {
				document
					.querySelectorAll('.file')
					.forEach((element) => element.classList.add('selected'));
			} else
				document
					.querySelectorAll('.file')
					.forEach((element) => element.classList.remove('selected'));
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
/*import copyLocation from '../Files/File Operation/location';
import { getSelected } from '../Files/File Operation/select';
import { updateTheme } from '../Theme/theme';
import {
	toggleHideHiddenFilesValue,
	getHideHiddenFilesValue,
} from '../Functions/toggleHiddenFiles';
import Copy from '../Files/File Operation/copy';
import Cut from '../Files/File Operation/cut';
import Paste from '../Files/File Operation/paste';
import Pin from '../Files/File Operation/pin';
import { Trash, PermanentDelete } from '../Files/File Operation/trash';
import { Preview } from '../Files/File Preview/preview';
import windowGUID from '../Constants/windowGUID';
import remote from '@electron/remote';
import focusingPath from '../Functions/focusingPath';
import Properties from '../Properties/properties';
import Undo from '../Files/File Operation/undo';
import Redo from '../Files/File Operation/redo';
import openInTerminal from '../Functions/openInTerminal';
import New from '../Functions/new';
*/

/**
 * Shortcut initializer function for Xplorer
 * @returns {void}
 */
/*const Shortcut = (): void => {
	const { reload, minimize, maximize } = require('../Layout/windowManager'); //eslint-disable-line
	const { createNewTab, goBack, goForward } = require('../Layout/tab'); //eslint-disable-line

	const KeyboardShortcutsHandler = (e: KeyboardEvent) => {
		e.preventDefault();
		const selectedFilePath = unescape(getSelected()?.[0]?.dataset?.path);
		const isDir = getSelected()?.[0]?.dataset.isdir === 'true';

		// Check if file navigator input is in focus, if it is then ignore key shortcuts
		if (
			document.querySelector('.path-navigator') === document.activeElement
		)
			return;

		
		
		// Cut file shortcut (Ctrl+X)
		else if (e.ctrlKey && e.key === 'x') {
			const filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			Cut(filePaths);
		}
		// Pin to sidebar shortcut (Alt+P)
		else if (e.altKey && e.key === 'p') {
			let filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			if (!filePaths.length) filePaths = [focusingPath()];
			Pin(filePaths);
		}
		// Delete file shortcut (Del)
		else if (e.key === 'Delete') {
			if (e.shiftKey) {
				const filePaths = [];
				for (const element of getSelected()) {
					filePaths.push(
						focusingPath() === 'xplorer://Trash'
							? unescape(element.dataset.realPath)
							: unescape(element.dataset.path)
					);
				}
				PermanentDelete(filePaths);
			} else {
				const filePaths = [];
				for (const element of getSelected()) {
					filePaths.push(unescape(element.dataset.path));
				}
				Trash(filePaths);
			}
		}
		// Preview file shortcut (Ctrl+O)
		else if (e.ctrlKey && e.key === 'o') {
			Preview(selectedFilePath);
		}
		// File properties (Ctrl+P)
		else if (e.ctrlKey && e.key === 'p') {
			Properties(
				selectedFilePath === 'undefined'
					? focusingPath()
					: selectedFilePath
			);
		}
		// Undo file action (Ctrl+Z)
		else if (e.ctrlKey && e.key === 'z') {
			Undo();
		}
		// Redo file action (Ctrl+Shift+Z OR Ctrl+Y)
		else if (
			(e.ctrlKey && e.shiftKey && e.key === 'z') ||
			(e.ctrlKey && e.key === 'y')
		) {
			Redo();
		}
	};
	document.addEventListener('keyup', KeyboardShortcutsHandler);
	document.addEventListener('mouseup', MouseShortcutsHandler);

	window.addEventListener('beforeunload', () => {
		document.removeEventListener('keyup', KeyboardShortcutsHandler, false);
		document.addEventListener('mouseup', MouseShortcutsHandler);
	});
};*/
