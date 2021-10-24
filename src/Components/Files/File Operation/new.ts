import { dialog } from '@electron/remote';
import path from 'path';
import { ErrorLog, OperationLog } from '../../Functions/log';
import focusingPath from '../../Functions/focusingPath';
import { createFile, exists, mkdirRecursively } from '../../Functions/fileSystem';

/**
 * Create a new file
 * @param {string} fileName - name for the new file
 * @param {string} parentDir - parent directory of the new file
 * @returns {void}
 */
const NewFile = async (
	fileName: string,
	parentDir: string = focusingPath()
): Promise<void> => {
	const newFileName = path.join(parentDir, fileName);
	const fileExists = await exists(newFileName);

	if (fileExists) {
		await dialog.showMessageBox({
			message: 'A file with that name already exists.',
			type: 'error',
		});
	} else {
		try {
			await mkdirRecursively(path.join(parentDir));
			await createFile(newFileName);
		} catch (err) {
			await dialog.showMessageBox({
				message: 'Error creating file. Please try again.',
				type: 'error',
			});
			ErrorLog(err);
		}

		OperationLog('newfile', null, path.join(parentDir, fileName));
	}
};

export default NewFile;
