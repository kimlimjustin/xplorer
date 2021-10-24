import { dialog } from '@electron/remote';
import path from 'path';
import { ErrorLog, OperationLog } from '../Functions/log';
import focusingPath from '../Functions/focusingPath';
import { exists, mkdirRecursively } from '../Functions/fileSystem';

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
	const fileExists = await exists(newFileName);

	if (fileExists) {
		await dialog.showMessageBox({
			message: 'A folder with that name already exists.',
			type: 'error',
		});
	} else {
		try {
			await mkdirRecursively(path.join(parentDir, folderName));
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
