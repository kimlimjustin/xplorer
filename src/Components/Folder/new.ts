import { ErrorLog, OperationLog } from '../Functions/log';
import fs from 'fs/promises';
import { dialog } from '@electron/remote';
import path from 'path';
import focusingPath from '../Functions/focusingPath';
import { mkdirRecursively } from '../Functions/mkdirRecursively';

/**
 * Create a folder
 * @param {string} folderName - name for the new folder
 * @param {string} parentDir - parent directory of the new folder
 * @returns {void}
 */
const NewFolder = async (
	folderName: string,
	parentDir: string = focusingPath()
): Promise<void> => {
	const newFileName = path.join(parentDir, folderName);
	const fileExists = await fs.stat(newFileName);

	if (fileExists) {
		await dialog.showMessageBox({
			message: 'A folder with that name already exists.',
			type: 'error',
		});
	} else {
		await mkdirRecursively(path.join(parentDir, folderName));

		try {
			await fs.mkdir(path.join(parentDir, folderName))
		} catch (err) {
			await dialog.showMessageBox({
				message: `Error creating folder. Please try again.`,
				type: 'error',
			});
			ErrorLog(err);
		}

		OperationLog('newfolder', null, path.join(parentDir, folderName));
	}
};

export default NewFolder;
