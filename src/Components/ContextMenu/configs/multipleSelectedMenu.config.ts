import { getSelected } from '../../Files/File Operation/select';
import contextMenuItem from '../../../Typings/contextMenuItem';
import { isVSCodeInstalled } from '../../../Service/app';
import { createNewTab } from '../../Layout/tab';
import Cut from '../../Files/File Operation/cut';
import Copy from '../../Files/File Operation/copy';
import { Purge, Restore, Trash } from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';
import Translate from '../../I18n/i18n';
import reveal from '../../../Service/reveal';
import focusingPath from '../../Functions/focusingPath';
import FileAPI from '../../../Service/files';
const MultipleSelectedMenu = async (_: HTMLElement, _filePath: string): Promise<contextMenuItem[][]> => {
	const _focusingPath = await focusingPath();
	const selectedFiles = getSelected();
	const SELECTED_FILES_ARE_FILES = Array.from(selectedFiles).every((file) => file.dataset.isdir !== 'true');
	return [
		[
			{
				menu: await Translate('Open'),
				shortcut: 'Enter',
				icon: 'open',
				visible: SELECTED_FILES_ARE_FILES,
				role: () => {
					selectedFiles.forEach((file) => {
						new FileAPI(decodeURI(file.dataset.path)).openFile();
					});
				},
			},
			{
				menu: await Translate('Open in New Tab'),
				role: () => {
					for (const element of getSelected()) {
						if (element.dataset.isdir === 'true') {
							createNewTab(decodeURI(element.dataset.path));
						}
					}
				},
				icon: 'open in new tab',
			},
			{
				menu: await Translate('Open in VSCode'),
				role: () => {
					for (const selected of getSelected()) {
						const targetPath = decodeURI(selected.dataset.path) === 'undefined' ? _focusingPath : decodeURI(selected.dataset.path);
						reveal(targetPath, 'vscode');
					}
				},
				shortcut: 'Shift+Enter',
				visible: await isVSCodeInstalled(),
				icon: 'vscode',
			},
		],
		[
			{
				menu: await Translate('Cut'),
				shortcut: 'Ctrl+X',
				icon: 'cut',
				role: () => {
					const paths = [];
					for (const element of getSelected()) {
						paths.push(decodeURI(element.dataset.path));
					}
					Cut(paths);
				},
			},
			{
				menu: await Translate('Copy'),
				shortcut: 'Ctrl+C',
				icon: 'copy',
				role: () => {
					const paths = [];
					for (const element of getSelected()) {
						paths.push(decodeURI(element.dataset.path));
					}
					Copy(paths);
				},
			},
			{
				menu: await Translate('Delete'),
				shortcut: 'Del',
				icon: 'delete',
				role: () => {
					const paths = [];
					for (const element of getSelected()) {
						paths.push(decodeURI(element.dataset.path));
					}
					Trash(paths);
				},
			},
			{
				menu: await Translate('Compress to Zip'),
				icon: 'zip',
				role: () => {
					const selectedFilesPath = [...selectedFiles].map((file) => decodeURI(file.dataset.path));
					new FileAPI(selectedFilesPath).zip();
				},
			},
		],
		[
			{
				menu: await Translate('Restore these files'),
				visible: _focusingPath === 'xplorer://Trash',
				icon: 'delete',
				role: () => {
					const filePaths = [];
					for (const element of getSelected()) {
						filePaths.push(decodeURI(element.dataset.path));
					}
					Restore(filePaths);
				},
			},
			{
				menu: await Translate('Permanently delete these files'),
				visible: _focusingPath === 'xplorer://Trash',
				icon: 'delete',
				role: () => {
					const filePaths = [];
					for (const element of getSelected()) {
						filePaths.push(decodeURI(element.dataset.path));
					}
					Purge(filePaths);
				},
			},
		],
		[
			{
				menu: await Translate('Pin to Sidebar'),
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => {
					const paths = [];
					for (const element of getSelected()) {
						paths.push(decodeURI(element.dataset.path));
					}
					Pin(paths);
				},
			},
		],
	];
};

export default MultipleSelectedMenu;
