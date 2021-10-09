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
import { Trash } from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';
import Properties from '../../Properties/properties';

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
				menu: 'Open',
				shortcut: 'Enter',
				icon: 'open',
				role: () => {
					if (target.dataset.isdir !== 'true') {
						openFileWithDefaultApp(filePath);
					} else open(filePath);
				},
			},
			{
				menu: 'Open in new tab',
				visible: target?.dataset?.isdir === 'true',
				icon: 'open in new tab',
				role: () => {
					createNewTab(filePath);
				},
			},
			{
				menu: 'Open in terminal',
				visible: target?.dataset?.isdir === 'true',
				shortcut: 'Alt+T',
				icon: 'terminal',
				role: () => {
					openInTerminal(filePath);
				},
			},
			{
				menu: 'Open in VSCcode',
				visible: vscodeInstalled,
				shortcut: 'Shift+Enter',
				icon: 'vscode',
				role: () => {
					const { execSync } = require('child_process');
					execSync(`code "${filePath.replaceAll('"', '\\"')}"`);
				},
			},
			{
				menu: 'Preview',
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
				menu: 'Cut',
				shortcut: 'Ctrl+X',
				icon: 'cut',
				role: () => Cut([filePath]),
			},
			{
				menu: 'Copy',
				shortcut: 'Ctrl+C',
				icon: 'copy',
				role: () => Copy([filePath]),
			},
			{
				menu: 'Copy Location Path',
				shortcut: 'Alt+Shift+C',
				icon: 'location',
				role: () => copyLocation(target),
			},
		],
		[
			{
				menu: 'Rename',
				shortcut: 'F2',
				icon: 'rename',
				role: () => Rename(filePath),
			},
			{
				menu: 'Delete',
				shortcut: 'Del',
				icon: 'delete',
				role: () => Trash([filePath]),
			},
			{
				menu: isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar',
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => Pin([filePath]),
			},
		],
		[
			{
				menu: 'Properties',
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
