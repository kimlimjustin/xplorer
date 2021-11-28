import { getSelected } from '../../Files/File Operation/select';
import contextMenuItem from '../../../Typings/contextMenuItem';
import { isVSCodeInstalled } from '../../../Api/app';
import { createNewTab } from '../../Layout/tab';
import Cut from '../../Files/File Operation/cut';
import Copy from '../../Files/File Operation/copy';
import { Purge, Restore, Trash } from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';
import Translate from '../../I18n/i18n';
import reveal from '../../../Api/reveal';
import focusingPath from '../../Functions/focusingPath';

const MultipleSelectedMenu = async (_: HTMLElement, _filePath: string): Promise<contextMenuItem[][]> => {
	const _focusingPath = await focusingPath();
	return [
		[
			{
				menu: await Translate('Open in New Tab'),
				role: () => {
					for (const element of getSelected()) {
						if (element.dataset.isdir === 'true') {
							createNewTab(unescape(element.dataset.path));
						}
					}
				},
				icon: 'open in new tab',
			},
			{
				menu: await Translate('Open in VSCode'),
				role: () => {
					for (const selected of getSelected()) {
						const targetPath = unescape(selected.dataset.path) === 'undefined' ? _focusingPath : unescape(selected.dataset.path);
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
						paths.push(unescape(element.dataset.path));
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
						paths.push(unescape(element.dataset.path));
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
						paths.push(unescape(element.dataset.path));
					}
					Trash(paths);
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
						filePaths.push(unescape(element.dataset.path));
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
						filePaths.push(unescape(element.dataset.path));
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
						paths.push(unescape(element.dataset.path));
					}
					Pin(paths);
				},
			},
		],
	];
};

export default MultipleSelectedMenu;
