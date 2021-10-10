import NewFile from '../Files/File Operation/new';
import NewFolder from '../Folder/new';
import { detectDefaultTheme } from '../Theme/theme';
import storage from 'electron-json-storage-sync';
import prompt from 'electron-prompt';
import path from 'path';

/**
 * Create new file/folder with prompting asking file/folder name
 * @param {'file'|'folder'} type
 * @returns {void}
 */
const New = (type: 'file' | 'folder'): void => {
	const themeCategory =
		storage.get('theme')?.data?.category ?? detectDefaultTheme();
	const customStylesheet = path.join(
		__dirname,
		`../Patches/${
			themeCategory === 'light' ? 'prompt-light.css' : 'prompt-dark.css'
		}`
	);
	if (type === 'file') {
		prompt({
			title: 'New File',
			label: 'File Name:',
			inputAttrs: { type: 'text', required: true },
			type: 'input',
			icon: path.join(__dirname, '../../../icons/icon.png'),
			alwaysOnTop: true,
			customStylesheet,
		}).then((fileName: string) => {
			if (fileName) NewFile(fileName);
		});
	} else if (type === 'folder') {
		prompt({
			title: 'New Folder',
			label: 'Folder Name:',
			inputAttrs: { type: 'text', required: true },
			type: 'input',
			icon: path.join(__dirname, '../../../icons/icon.png'),
			alwaysOnTop: true,
			customStylesheet,
		}).then((folderName: string) => {
			if (folderName) NewFolder(folderName);
		});
	}
};

export default New;
