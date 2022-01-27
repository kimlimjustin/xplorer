import { OperationLog } from '../../Functions/log';
import focusingPath from '../../Functions/focusingPath';
import FileAPI from '../../../Service/files';
import PromptError from '../../Prompt/error';

/**
 * Create a new file
 * @param {string} fileName - name for the new file
 * @param {string} parentDir - parent directory of the new file
 * @param {boolean} writeLog - does the operation need to be written
 * @returns {Promise<void>}
 */
const NewFile = async (fileName: string, parentDir?: string, writeLog = true): Promise<void> => {
	if (!parentDir) parentDir = await focusingPath();
	const newFile = new FileAPI(fileName, parentDir);

	if (await newFile.exists()) {
		PromptError('Error creating file', `Failed to create file ${newFile.fileName}: File already existed`);
	} else {
		try {
			await newFile.createFile();
		} catch (err) {
			PromptError('Error creating file', `Failed to create file ${newFile.fileName}: Something went wrong (${err})`);
		}

		if (writeLog) {
			if (typeof newFile.fileName === 'string') {
				OperationLog('newfile', null, newFile.fileName);
			}
		}
	}
};

export default NewFile;
