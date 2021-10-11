import { ErrorLog, OperationLog } from '../Functions/log';
import fs from 'fs';
import { dialog } from '@electron/remote';
import path from 'path';
import focusingPath from '../Functions/focusingPath';

/**
 * Create a folder
 * @param {string} folderName - name for the new folder
 * @param {string} parentDir - parent directory of the new folder
 * @returns {any}
 */
const NewFolder = (
	folderName: string,
	parentDir: string = focusingPath()
): void => {
	if (fs.existsSync(path.join(parentDir, folderName))) {
		dialog.showMessageBoxSync({
			message: 'A folder with that name already exists.',
			type: 'error',
		});
	} else {
		for (let i = 1; i < folderName.split('/').length; i++) {
			if (
				!fs.existsSync(
					path.join(
						parentDir,
						folderName.split('/').splice(0, i).join('/')
					)
				)
			) {
				fs.mkdirSync(
					path.join(
						parentDir,
						folderName.split('/').splice(0, i).join('/')
					)
				);
			}
		}
		fs.mkdir(path.join(parentDir, folderName), (err) => {
			if (err) {
				dialog.showMessageBoxSync({
					message: `Error creating folder. Please try again.`,
					type: 'error',
				});
				ErrorLog(err);
			}
		});
		OperationLog('newfolder', null, path.join(parentDir, folderName));
	}
};
export default NewFolder;
