import contextMenuItem from '../../../Typings/contextMenuItem';
import Storage from '../../../Service/storage';
import { reload } from '../../Layout/windowManager';
import Paste from '../../Files/File Operation/paste';
import Undo from '../../Files/File Operation/undo';
import Redo from '../../Files/File Operation/redo';
import copyLocation from '../../Files/File Operation/location';
import Pin from '../../Files/File Operation/pin';
import Properties from '../../Properties/properties';
import focusingPath from '../../Functions/focusingPath';
import reveal from '../../../Service/reveal';
import Translate from '../../I18n/i18n';
import New from '../../Functions/new';
import { isVSCodeInstalled } from '../../../Service/app';
import { Purge, Restore } from '../../Files/File Operation/trash';

interface Favorites {
	name: string;
	path: string;
}
const BodyMenu = async (target: HTMLElement, filePath: string): Promise<contextMenuItem[][]> => {
	const favorites: Favorites[] = (await Storage.get('sidebar'))?.favorites;
	const isPinned = !!favorites?.filter((favorite) => favorite.path === filePath).length ?? false;
	const _focusingPath = await focusingPath();

	const changeLayout = async (selectedLayout: 'l' | 'm' | 's' | 'd') => {
		const layout = (await Storage.get('layout')) ?? {};
		layout[_focusingPath] = selectedLayout;
		Storage.set('layout', layout);
		reload();
	};
	const changeSortMethod = async (selectedMethod: 'A' | 'Z' | 'L' | 'F' | 'S' | 'T') => {
		const sort = (await Storage.get('layout')) ?? {};
		sort[_focusingPath] = selectedMethod;
		Storage.set('sort', sort);
		reload();
	};
	return [
		[
			{
				menu: await Translate('Layout Mode'),
				submenu: [
					{
						name: await Translate('Grid View (Large)'),
						role: () => changeLayout('l'),
						icon: 'grid_large',
					},
					{
						name: await Translate('Grid View (Medium)'),
						role: () => changeLayout('m'),
						icon: 'grid_medium',
					},
					{
						name: await Translate('Grid View (Small)'),
						role: () => changeLayout('s'),
						icon: 'grid_small',
					},
					{
						name: await Translate('Detail View'),
						role: () => changeLayout('d'),
						icon: 'detail',
					},
				],
				icon: 'layout',
			},
			{
				menu: await Translate('Sort By'),
				submenu: [
					{
						name: await Translate('A-Z'),
						role: () => changeSortMethod('A'),
					},
					{
						name: await Translate('Z-A'),
						role: () => changeSortMethod('Z'),
					},
					{
						name: await Translate('Last Modified'),
						role: () => changeSortMethod('L'),
					},
					{
						name: await Translate('First Modified'),
						role: () => changeSortMethod('F'),
					},
					{
						name: await Translate('Size'),
						role: () => changeSortMethod('S'),
					},
					{
						name: await Translate('Type'),
						role: () => changeSortMethod('T'),
					},
				],
				icon: 'sort',
			},
			{
				menu: await Translate('Reload'),
				role: () => {
					reload();
				},
				shortcut: 'F5',
				icon: 'refresh',
			},
		],
		[
			{
				menu: await Translate('Paste'),
				visible: !_focusingPath.startsWith('xplorer://'),
				shortcut: 'Ctrl+V',
				icon: 'paste',
				role: () => {
					Paste(filePath);
				},
			},
			{
				menu: await Translate('Undo Action'),
				visible: !_focusingPath.startsWith('xplorer://'),
				shortcut: 'Ctrl+Z',
				icon: 'undo',
				role: () => {
					Undo();
				},
			},
			{
				menu: await Translate('Redo Action'),
				visible: !_focusingPath.startsWith('xplorer://'),
				shortcut: 'Ctrl+Y',
				icon: 'redo',
				role: () => {
					Redo();
				},
			},
			{
				menu: await Translate('Copy Location Path'),
				shortcut: 'Alt+Shift+C',
				icon: 'location',
				role: () => {
					copyLocation(target);
				},
			},
			{
				menu: await Translate('Clear Recent List'),
				icon: 'delete',
				visible: _focusingPath === 'xplorer://Recent',
				role: () => {
					Storage.set('recent', []);
					reload();
				},
			},
		],
		[
			{
				menu: await Translate('Open in Terminal'),
				visible: !_focusingPath.startsWith('xplorer://'),
				shortcut: 'Alt+T',
				icon: 'terminal',
				role: () => reveal(filePath, 'terminal'),
			},
			{
				menu: await Translate('Open in VSCode'),
				visible: (await isVSCodeInstalled()) && !_focusingPath.startsWith('xplorer://'),
				shortcut: 'Shift+Enter',
				icon: 'vscode',
				role: () => {
					reveal(filePath, 'vscode');
				},
			},
			{
				menu: await Translate('Restore all files'),
				visible: _focusingPath === 'xplorer://Trash',
				icon: 'delete',
				role: () => {
					const filePaths = [...document.querySelectorAll<HTMLElement>('.file')].map((file) => decodeURI(file.dataset.path));
					Restore(filePaths);
				},
			},
			{
				menu: await Translate('Permanently delete all files'),
				visible: _focusingPath === 'xplorer://Trash',
				icon: 'delete',
				role: () => {
					const filePaths = [...document.querySelectorAll<HTMLElement>('.file')].map((file) => decodeURI(file.dataset.path));
					Purge(filePaths);
				},
			},
			{
				menu: await Translate('New'),
				visible: !_focusingPath.startsWith('xplorer://'),
				submenu: [
					{ name: await Translate('Folder'), shortcut: 'Shift+N', role: () => New('folder') },
					{ name: await Translate('File'), shortcut: 'Alt+N', role: () => New('file') },
				],
				icon: 'new',
			},
		],
		[
			{
				menu: await Translate(isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar'),
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => {
					Pin([filePath]);
				},
			},
			{
				menu: await Translate('Properties'),
				shortcut: 'Ctrl+P',
				icon: target?.dataset?.isdir ? 'folder setting' : 'file setting',
				role: () => {
					Properties(filePath);
				},
			},
		],
	];
};

export default BodyMenu;
