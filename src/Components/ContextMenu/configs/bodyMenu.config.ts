import vscodeInstalled from '../../Constants/isVSCodeInstalled';
import contextMenuItem from '../../../Typings/contextMenuItem';
import storage from 'electron-json-storage-sync';
import { reload } from '../../Layout/windowManager';
import Paste from '../../Files/File Operation/paste';
import Undo from '../../Files/File Operation/undo';
import Redo from '../../Files/File Operation/redo';
import copyLocation from '../../Files/File Operation/location';
import Pin from '../../Files/File Operation/pin';
import Properties from '../../Properties/properties';
import focusingPath from '../../Functions/focusingPath';
import openInTerminal from '../../Functions/openInTerminal';
interface Favorites {
	name: string;
	path: string;
}
const BodyMenu = (
	target: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	const favorites: Favorites[] = storage.get('sidebar')?.data?.favorites;
	const isPinned =
		!!favorites?.filter((favorite) => favorite.path === filePath).length ??
		false;

	const changeLayout = (selectedLayout: 'l' | 'm' | 's' | 'd') => {
		const layout = storage.get('layout')?.data ?? {};
		layout[focusingPath()] = selectedLayout;
		storage.set('layout', layout);
		reload();
	};
	const changeSortMethod = (
		selectedMethod: 'A' | 'Z' | 'L' | 'F' | 'S' | 'T'
	) => {
		const sort = storage.get('layout')?.data ?? {};
		sort[focusingPath()] = selectedMethod;
		storage.set('sort', sort);
		reload();
	};
	return [
		[
			{
				menu: 'Layout Mode',
				submenu: [
					{
						name: 'Grid View (Large)',
						role: () => changeLayout('l'),
					},
					{
						name: 'Grid View (Medium)',
						role: () => changeLayout('m'),
					},
					{
						name: 'Grid View (Small)',
						role: () => changeLayout('s'),
					},
					{ name: 'Detail View', role: () => changeLayout('d') },
				],
				icon: 'layout',
			},
			{
				menu: 'Sort by',
				submenu: [
					{ name: 'A-Z', role: () => changeSortMethod('A') },
					{ name: 'Z-A', role: () => changeSortMethod('Z') },
					{
						name: 'Last Modified',
						role: () => changeSortMethod('L'),
					},
					{
						name: 'First Modified',
						role: () => changeSortMethod('F'),
					},
					{ name: 'Size', role: () => changeSortMethod('S') },
					{ name: 'Type', role: () => changeSortMethod('T') },
				],
				icon: 'sort',
			},
			{
				menu: 'Refresh',
				role: () => {
					reload();
				},
				shortcut: 'F5',
				icon: 'refresh',
			},
		],
		[
			{
				menu: 'Paste',
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Ctrl+V',
				icon: 'paste',
				role: () => {
					Paste(filePath);
				},
			},
			{
				menu: 'Undo Action',
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Ctrl+Z',
				icon: 'undo',
				role: () => {
					Undo();
				},
			},
			{
				menu: 'Redo Action',
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Ctrl+Y',
				icon: 'redo',
				role: () => {
					Redo();
				},
			},
			{
				menu: 'Copy Location Path',
				shortcut: 'Alt+Shift+C',
				icon: 'location',
				role: () => {
					copyLocation(target);
				},
			},
			{
				menu: 'Clear Recent List',
				icon: 'delete',
				role: () => {
					storage.set('recent', []);
					reload();
				},
			},
		],
		[
			{
				menu: 'Open in terminal',
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Alt+T',
				icon: 'terminal',
				role: () => openInTerminal(filePath),
			},
			{
				menu: 'Open in VSCode',
				visible:
					vscodeInstalled && !focusingPath().startsWith('xplorer://'),
				shortcut: 'Shift+Enter',
				icon: 'vscode',
				role: () => {
					const { execSync } = require('child_process');
					const os = require('os');
					if (
						process.platform === 'linux' &&
						filePath === 'xplorer://Home'
					)
						execSync(`code ${os.homedir()}`);
					else execSync(`code "${filePath.replaceAll('"', '\\"')}"`);
				},
			},
			{
				menu: 'New',
				visible: !focusingPath().startsWith('xplorer://'),
				submenu: [
					{ name: 'Folder', shortcut: 'Shift+N' },
					{ name: 'File', shortcut: 'Alt+N' },
				],
				icon: 'new',
			},
		],
		[
			{
				menu: isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar',
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => {
					Pin([filePath]);
				},
			},
			{
				menu: 'Properties',
				shortcut: 'Ctrl+P',
				icon: target?.dataset?.isdir
					? 'folder property'
					: 'file property',
				role: () => {
					Properties(filePath);
				},
			},
		],
	];
};

export default BodyMenu;
