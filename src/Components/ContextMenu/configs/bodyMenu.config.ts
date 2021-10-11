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
import Translate from '../../I18n/i18n';
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
				menu: Translate('Layout Mode'),
				submenu: [
					{
						name: Translate('Grid View (Large)'),
						role: () => changeLayout('l'),
					},
					{
						name: Translate('Grid View (Medium)'),
						role: () => changeLayout('m'),
					},
					{
						name: Translate('Grid View (Small)'),
						role: () => changeLayout('s'),
					},
					{
						name: Translate('Detail View'),
						role: () => changeLayout('d'),
					},
				],
				icon: 'layout',
			},
			{
				menu: Translate('Sort By'),
				submenu: [
					{
						name: Translate('A-Z'),
						role: () => changeSortMethod('A'),
					},
					{
						name: Translate('Z-A'),
						role: () => changeSortMethod('Z'),
					},
					{
						name: Translate('Last Modified'),
						role: () => changeSortMethod('L'),
					},
					{
						name: Translate('First Modified'),
						role: () => changeSortMethod('F'),
					},
					{
						name: Translate('Size'),
						role: () => changeSortMethod('S'),
					},
					{
						name: Translate('Type'),
						role: () => changeSortMethod('T'),
					},
				],
				icon: 'sort',
			},
			{
				menu: Translate('Reload'),
				role: () => {
					reload();
				},
				shortcut: 'F5',
				icon: 'refresh',
			},
		],
		[
			{
				menu: Translate('Paste'),
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Ctrl+V',
				icon: 'paste',
				role: () => {
					Paste(filePath);
				},
			},
			{
				menu: Translate('Undo Action'),
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Ctrl+Z',
				icon: 'undo',
				role: () => {
					Undo();
				},
			},
			{
				menu: Translate('Redo Action'),
				visible: !focusingPath().startsWith('xplorer://'),
				shortcut: 'Ctrl+Y',
				icon: 'redo',
				role: () => {
					Redo();
				},
			},
			{
				menu: Translate('Copy Location Path'),
				shortcut: 'Alt+Shift+C',
				icon: 'location',
				role: () => {
					copyLocation(target);
				},
			},
			{
				menu: Translate('Clear Recent List'),
				icon: 'delete',
				visible: focusingPath() === 'xplorer://Recent',
				role: () => {
					storage.set('recent', []);
					reload();
				},
			},
		],
		[
			{
				menu: 'Open in Terminal',
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
				menu: Translate('New'),
				visible: !focusingPath().startsWith('xplorer://'),
				submenu: [
					{ name: Translate('Folder'), shortcut: 'Shift+N' },
					{ name: Translate('File'), shortcut: 'Alt+N' },
				],
				icon: 'new',
			},
		],
		[
			{
				menu: Translate(
					isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar'
				),
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => {
					Pin([filePath]);
				},
			},
			{
				menu: Translate('Properties'),
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
