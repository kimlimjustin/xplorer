import {
	FILE_TYPES_AVAILABLE_FOR_PREVIEW,
	Preview,
} from '../../Files/File Preview/preview';
import path from 'path';
import vscodeInstalled from '../../Constants/isVSCodeInstalled';
import contextMenuItem from '../../../Typings/contextMenuItem';
import storage from 'electron-json-storage-sync';
import { open, openFileWithDefaultApp } from '../../Files/File Operation/open';
import { createNewTab } from '../../Layout/tab';
import openInTerminal from '../../Functions/openInTerminal';
import Cut from '../../Files/File Operation/cut';
import Copy from '../../Files/File Operation/copy';
import copyLocation from '../../Files/File Operation/location';
import Rename from '../../Files/File Operation/rename';
import {
	PermanentDelete,
	Restore,
	Trash,
} from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';
import Properties from '../../Properties/properties';
import focusingPath from '../../Functions/focusingPath';
import Translate from '../../I18n/i18n';

interface Favorites {
	name: string;
	path: string;
}

const FileMenu = (
	target: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	const favorites: Favorites[] = storage.get('sidebar')?.data?.favorites;
	const isPinned =
		!!favorites?.filter((favorite) => favorite.path === filePath).length ??
		false;
	return [
		[
			{
				menu: Translate('Open'),
				shortcut: 'Enter',
				icon: 'open',
				role: () => {
					if (target.dataset.isdir !== 'true') {
						openFileWithDefaultApp(filePath);
					} else open(filePath);
				},
			},
			{
				menu: Translate('Open in new tab'),
				visible: target?.dataset?.isdir === 'true',
				icon: 'open in new tab',
				role: () => {
					createNewTab(filePath);
				},
			},
			{
				menu: Translate('Open in terminal'),
				visible: target?.dataset?.isdir === 'true',
				shortcut: 'Alt+T',
				icon: 'terminal',
				role: () => {
					openInTerminal(filePath);
				},
			},
			{
				menu: Translate('Open in VSCcode'),
				visible: vscodeInstalled,
				shortcut: 'Shift+Enter',
				icon: 'vscode',
				role: () => {
					const { execSync } = require('child_process');
					execSync(`code "${filePath.replaceAll('"', '\\"')}"`);
				},
			},
			{
				menu: Translate('Preview'),
				visible:
					FILE_TYPES_AVAILABLE_FOR_PREVIEW.indexOf(
						path.extname(target?.dataset?.path)
					) !== -1,
				shortcut: 'Ctrl+O',
				icon: 'preview',
				role: () => Preview(filePath),
			},
		],
		[
			{
				menu: Translate('Cut'),
				shortcut: 'Ctrl+X',
				icon: 'cut',
				role: () => Cut([filePath]),
			},
			{
				menu: Translate('Copy'),
				shortcut: 'Ctrl+C',
				icon: 'copy',
				role: () => Copy([filePath]),
			},
			{
				menu: Translate('Copy Location Path'),
				shortcut: 'Alt+Shift+C',
				icon: 'location',
				role: () => copyLocation(target),
			},
		],
		[
			{
				menu: Translate('Rename'),
				shortcut: 'F2',
				icon: 'rename',
				role: () => Rename(filePath),
			},
			{
				menu: Translate('Delete'),
				visible: focusingPath() !== 'xplorer://Trash',
				shortcut: 'Del',
				icon: 'delete',
				role: () => Trash([filePath]),
			},
			{
				menu: Translate('Restore'),
				icon: 'delete',
				visible: focusingPath() === 'xplorer://Trash',
				role: () => Restore(filePath),
			},
			{
				menu: Translate('Permanently Delete'),
				icon: 'delete',
				visible: focusingPath() === 'xplorer://Trash',
				shortcut: 'Shift+Del',
				role: () =>
					PermanentDelete([unescape(target.dataset.realPath)]),
			},
			{
				menu: Translate(
					isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar'
				),
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => Pin([filePath]),
			},
		],
		[
			{
				menu: Translate('Properties'),
				shortcut: 'Ctrl+P',
				icon: target?.dataset?.isdir
					? 'folder property'
					: 'file property',
				role: () => Properties(filePath),
			},
		],
	];
};

export default FileMenu;
