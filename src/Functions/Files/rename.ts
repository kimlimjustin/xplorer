import prompt from 'electron-prompt';
import path from 'path';
import fs from 'fs';
import { ErrorLog } from '../Logs/log';
import { dialog } from '@electron/remote';

/**
 * Rename file/folder name
 * @param {string} path - location of the file/folder
 * @returns {void}
 */
const Rename = (filePath: string): void => {
	prompt({
		title: 'New File Name',
		label: 'New Name:',
		inputAttrs: { type: 'text', required: true },
		type: 'input',
		value: path.basename(filePath),
		icon: path.join(__dirname, '../../../../icons/icon.png'),
	}).then((newName: string) => {
		fs.rename(
			filePath,
			path.join(path.dirname(filePath), newName),
			(err) => {
				if (err) {
					dialog.showMessageBoxSync({
						message:
							'Something went wrong, please try again or open an issue on GitHub.',
						type: 'error',
					});
					ErrorLog(err);
				}
			}
		);
	});
	console.log(path);
};

export default Rename;
