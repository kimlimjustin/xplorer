import copyLocation from '../Files/File Operation/location';
import { getSelected } from '../Files/File Operation/select';
import { execSync, exec } from 'child_process';
import NewFile from '../Files/File Operation/new';
import Rename from '../Files/File Operation/rename';
import { updateTheme } from '../Theme/theme';
import storage from 'electron-json-storage-sync';
import {
	toggleHideHiddenFilesValue,
	getHideHiddenFilesValue,
} from '../Functions/toggleHiddenFiles';
import path from 'path';
import Copy from '../Files/File Operation/copy';
import Cut from '../Files/File Operation/cut';
import Paste from '../Files/File Operation/paste';
import Pin from '../Files/File Operation/pin';
import { Trash, PermanentDelete } from '../Files/File Operation/trash';
import {
	Preview,
	FILE_TYPES_AVAILABLE_FOR_PREVIEW,
} from '../Files/File Preview/preview';
import windowGUID from '../Constants/windowGUID';
import remote from '@electron/remote';
import focusingPath from '../Functions/focusingPath';
import Properties from '../Properties/properties';
import Undo from '../Files/File Operation/undo';
import Redo from '../Files/File Operation/redo';
let vscodeInstalled = false;
try {
	execSync('code --version');
	vscodeInstalled = true;
} catch (_) {
	console.log('INFO: vscode not installed');
}

let selectedAll = true;

/**
 * Get if currently selecting all files
 * @returns {boolean} currently selecting all files
 */
const getSelectedStatus = (): boolean => selectedAll;
/**
 * Change selected all status
 * @returns {void}
 */
const changeSelectedStatus = (): void => {
	selectedAll = false;
};

/**
 * Shortcut initializer function for Xplorer
 * @returns {void}
 */
const Shortcut = (): void => {
	const { reload, minimize, maximize } = require('../Layout/windowManager'); //eslint-disable-line
	const { createNewTab, goBack, goForward } = require('../Layout/tab'); //eslint-disable-line
	const ShortcutHandler = (e: KeyboardEvent) => {
		e.preventDefault();
		const selectedFilePath = unescape(getSelected()?.[0]?.dataset?.path);
		const isDir = getSelected()?.[0]?.dataset.isdir === 'true';

		// Check if file navigator input is in focus, if it is then ignore key shortcuts
		if (
			document.querySelector('.path-navigator') === document.activeElement
		)
			return;

		// Select all shortcut (Ctrl + A)
		if (e.key === 'a' && e.ctrlKey) {
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
		// New file shortcut (Alt + N)
		else if (e.key === 'n' && e.altKey && !e.shiftKey) {
			NewFile('new file');
		}
		// New folder shortcut (Shift + N)
		else if (e.key === 'N' && !e.altKey && e.shiftKey) {
			NewFile('new folder');
		} else if (e.key === 'F2') {
			if (getSelected()[0]) Rename(getSelected()[0].dataset.path);
		}
		// Open file shorcut (Enter)
		else if (e.key === 'Enter') {
			for (const selected of getSelected()) {
				// Open file in vscode (Shift + Enter)
				if (e.shiftKey && vscodeInstalled) {
					const targetPath =
						unescape(selected.dataset.path) === 'undefined'
							? focusingPath()
							: unescape(selected.dataset.path);
					exec(`code "${targetPath.replaceAll('"', '\\"')}"`);
				} else {
					const {
						open,
						openFileWithDefaultApp,
					} = require('../Files/File Operation/open'); //eslint-disable-line
					if (isDir) {
						open(selectedFilePath);
					} else {
						openFileWithDefaultApp(selectedFilePath);
					}
				}
			}
		}
		// Copy location path (Alt + Shift + C)
		else if (e.key === 'C' && e.altKey && e.shiftKey) {
			copyLocation(getSelected()[0]);
		}
		// Refresh page shortcut (Ctrl+R, F5)
		else if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') reload();
		// Minimze window shortcut (Alt+Arrow Down, F10)
		else if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F10')
			minimize();
		// Maximize window shortcut (Alt+Arrow Up, F11)
		else if ((e.altKey && e.key === 'ArrowUp') || e.key === 'F11')
			maximize();
		// New tab shortcut (Ctrl+T)
		else if (e.ctrlKey && e.key === 't') {
			createNewTab();
			updateTheme();
		}
		// Exit tab shortcut (Ctrl+E)
		else if (e.ctrlKey && e.key === 'e') {
			const tabs = storage.get(`tabs-${windowGUID}`)?.data;
			if (document.querySelectorAll('.tab').length === 1) {
				const electronWindow = remote.BrowserWindow.getFocusedWindow();
				electronWindow.close();
			} else {
				const tab = document.getElementById(`tab${tabs.focus}`);
				tab.parentElement.removeChild(tab);
				tabs.focusHistory = tabs.focusHistory.filter(
					(tabIndex: number) => String(tabIndex) !== tabs.focus
				);
				tabs.focus = String(
					tabs.focusHistory[tabs.focusHistory.length - 1]
				);
				delete tabs.tabs[tabs.focus];
				storage.set(`tabs-${windowGUID}`, tabs);
			}
		}
		// Previous tab shortcut (Alt+Arrow Left)
		else if (e.altKey && e.key === 'ArrowLeft') {
			goBack();
		}
		// Next tab shortcut (Alt+Arrow Right)
		else if (e.altKey && e.key === 'ArrowRight') {
			goForward();
		}
		// Toggle hidden files shortcut (Ctrl+H)
		else if (e.ctrlKey && e.key === 'h') {
			const userPreference = storage.get('preference')?.data; // Read user preference
			toggleHideHiddenFilesValue();
			const hideHiddenFiles = getHideHiddenFilesValue();
			storage.set(
				'preference',
				Object.assign({}, userPreference, { hideHiddenFiles })
			);
			document.getElementById('workspace').dataset.hideHiddenFiles =
				String(hideHiddenFiles);
			(
				document.getElementById('show-hidden-files') as HTMLInputElement
			).checked = !hideHiddenFiles;
		}
		// Open in terminal shortcut (Alt + T)
		else if (e.altKey && e.key === 't') {
			const filePath = selectedFilePath ?? focusingPath();
			if (process.platform === 'win32') {
				execSync(
					`${filePath.split('\\')[0]} && cd ${
						selectedFilePath === 'undefined'
							? focusingPath()
							: selectedFilePath
					} && start cmd`
				);
			} else if (process.platform === 'linux') {
				execSync(
					`gnome-terminal --working-directory="${
						selectedFilePath === 'undefined'
							? focusingPath()
							: selectedFilePath
					}"`
				);
			} else {
				execSync(
					`open -a Terminal ${
						selectedFilePath === 'undefined'
							? focusingPath()
							: selectedFilePath
					}`
				);
			}
		}
		// Copy file shortcut (Ctrl+C)
		else if (e.ctrlKey && e.key === 'c') {
			const filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			Copy(filePaths);
		}
		// Cut file shortcut (Ctrl+X)
		else if (e.ctrlKey && e.key === 'x') {
			const filePaths = [];
			for (const element of getSelected()) {
				filePaths.push(unescape(element.dataset.path));
			}
			Cut(filePaths);
		}
		// Paste file shortcut (Ctrl+V)
		else if (e.ctrlKey && e.key === 'v') {
			Paste(focusingPath());
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
			if (
				FILE_TYPES_AVAILABLE_FOR_PREVIEW.indexOf(
					path.extname(selectedFilePath)
				) !== -1
			) {
				Preview(selectedFilePath);
			}
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
	document.addEventListener('keyup', ShortcutHandler);
	window.addEventListener('beforeunload', () => {
		document.removeEventListener('keyup', ShortcutHandler, false);
	});
};

export { Shortcut, selectedAll, changeSelectedStatus, getSelectedStatus };
