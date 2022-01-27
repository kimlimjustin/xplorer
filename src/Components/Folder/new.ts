import { OperationLog } from '../Functions/log';
import focusingPath from '../Functions/focusingPath';
import FolderAPI from '../../Service/directory';
import PromptError from '../Prompt/error';
/**
 * Create a folder
 * @param {string} folderName - name for the new folder
 * @param {string} parentDir - parent directory of the new folder
 * @param {boolean} writeLog - does the operation need to be written
 * @returns {void}
 */
const NewFolder = async (folderName: string, parentDir?: string, writeLog = true): Promise<void> => {
	if (!parentDir) parentDir = await focusingPath();

	const newFolder = new FolderAPI(folderName, parentDir);

	if (await newFolder.exists()) {
		PromptError('Error creating folder', `Failed to create folder ${newFolder.dirName}: Folder already existed`);
	} else {
		try {
			await newFolder.mkdir();
			if (writeLog) OperationLog('newfolder', null, newFolder.dirName);
		} catch (err) {
			PromptError('Error creating file', `Failed to create file ${newFolder.dirName}: Something went wrong (${err})`);
		}
	}
};

export default NewFolder;
