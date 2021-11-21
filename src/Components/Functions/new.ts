import NewFile from '../Files/File Operation/new';
import NewFolder from '../Folder/new';
import Ask from '../Prompt/ask';
import focusingPath from './focusingPath';

/**
 * Create new file/folder with prompting asking file/folder name
 * @param {'file'|'folder'} type
 * @returns {Promise<void>}
 */
const New = async (type: 'file' | 'folder'): Promise<void> => {
	/**
	 * Don't react if the user is on non-directory page
	 */
	if ((await focusingPath()).startsWith('xplorer://')) return;
	if (type === 'file') {
		Ask('New File', 'File Name:').then(async (fileName: string) =>
			NewFile(fileName, await focusingPath())
		);
	} else if (type === 'folder') {
		Ask('New Folder', 'Folder Name:').then(async (folderName: string) =>
			NewFolder(folderName, await focusingPath())
		);
	}
};

export default New;
