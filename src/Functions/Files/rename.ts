import prompt from 'electron-prompt';
import path from 'path';
import fs from 'fs';
import { ErrorLog } from '../Logs/log';
import { dialog } from '@electron/remote';
import storage from 'electron-json-storage-sync';
import { detectDefaultTheme } from '../Theme/theme';
import windowGUID from '../../Constants/windowGUID';
import os from 'os';

/**
 * Rename file/folder name
 * @param {string} path - location of the file/folder
 * @returns {void}
 */
const Rename = (filePath: string): void => {
	const themeCategory =
		storage.get('theme')?.data?.category ?? detectDefaultTheme();
	const customStylesheet = path.join(
		__dirname,
		`../../public/${
			themeCategory === 'light' ? 'prompt-light.css' : 'prompt-dark.css'
		}`
	);
	prompt({
		title: 'New File Name',
		label: 'New Name:',
		inputAttrs: { type: 'text', required: true },
		type: 'input',
		value: unescape(path.basename(filePath)),
		icon: path.join(__dirname, '../../../../icons/icon.png'),
		alwaysOnTop: true,
		customStylesheet,
	}).then((newName: string) => {
		const tabs = storage.get(`tabs-${windowGUID}`)?.data;
		const focusingPath =
			tabs.tabs[tabs.focus].position === 'Home' ||
			tabs.tabs[tabs.focus].position === path.join(os.homedir(), 'Home')
				? os.homedir()
				: tabs.tabs[tabs.focus].position;
		const target =
			path.dirname(newName) === '.'
				? path.join(focusingPath, newName)
				: path.join(path.dirname(filePath), newName);
		fs.rename(unescape(filePath), target, (err) => {
			if (err) {
				dialog.showMessageBoxSync({
					message:
						'Something went wrong, please try again or open an issue on GitHub.',
					type: 'error',
				});
				ErrorLog(err);
			}
		});
	});
};

export default Rename;
