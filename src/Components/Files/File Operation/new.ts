import { ErrorLog, OperationLog } from '../../Functions/log';
import fs from 'fs';
import { dialog } from '@electron/remote';
import path from 'path';
import focusingPath from '../../Functions/focusingPath';

/**
 * Create a new file
 * @param {string} folderName - name for the new file
 * @param {string} parentDir - parent directory of the new file
 * @returns {any}
 */
const NewFile = (
	fileName: string,
	parentDir: string = focusingPath()
): void => {
	if (fs.existsSync(path.join(parentDir, fileName))) {
		dialog.showMessageBoxSync({
			message: 'A file with that name already exists.',
			type: 'error',
		});
	} else {
		for (let i = 1; i < fileName.split('/').length; i++) {
			if (
				!fs.existsSync(
					path.join(
						parentDir,
						fileName.split('/').splice(0, i).join('/')
					)
				)
			) {
				fs.mkdirSync(
					path.join(
						parentDir,
						fileName.split('/').splice(0, i).join('/')
					)
				);
			}
		}
		fs.writeFile(path.join(parentDir, fileName), '', (err) => {
			if (err) {
				dialog.showMessageBoxSync({
					message: 'Error creating file. Please try again.',
					type: 'error',
				});
				ErrorLog(err);
			}
		});
		OperationLog('newfile', null, path.join(parentDir, fileName));
	}
};
export default NewFile;
