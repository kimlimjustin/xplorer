import Preview from '../../Files/File Preview/preview';
import { isVSCodeInstalled } from '../../../Service/app';
import contextMenuItem from '../../../Typings/contextMenuItem';
import { createNewTab } from '../../Layout/tab';
import reveal from '../../../Service/reveal';
import Cut from '../../Files/File Operation/cut';
import Copy from '../../Files/File Operation/copy';
import copyLocation from '../../Files/File Operation/location';
import Rename from '../../Files/File Operation/rename';
import { Purge, Restore, Trash } from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';
import Properties from '../../Properties/properties';
import focusingPath from '../../Functions/focusingPath';
import Translate from '../../I18n/i18n';
import { OpenDir } from '../../Open/open';
import FileAPI from '../../../Service/files';
import Storage from '../../../Service/storage';
import Ask from '../../Prompt/ask';
interface Favorites {
	name: string;
	path: string;
}

const FileMenu = async (target: HTMLElement, filePath: string): Promise<contextMenuItem[][]> => {
	const favorites: Favorites[] = (await Storage.get('sidebar'))?.favorites;
	const isPinned = !!favorites?.filter((favorite) => favorite.path === filePath).length ?? false;
	const _focusingPath = await focusingPath();
	return [
		[
			{
				menu: await Translate('Open'),
				shortcut: 'Enter',
				icon: 'open',
				role: () => {
					if (target.dataset.isdir !== 'true') {
						new FileAPI(filePath).openFile();
					} else OpenDir(filePath);
				},
			},
			{
				menu: await Translate('Open in New Tab'),
				visible: target?.dataset?.isdir === 'true',
				icon: 'open in new tab',
				role: () => {
					createNewTab(filePath);
				},
			},
			{
				menu: await Translate('Open in Terminal'),
				visible: target?.dataset?.isdir === 'true',
				shortcut: 'Alt+T',
				icon: 'terminal',
				role: () => {
					reveal(filePath, 'terminal');
				},
			},
			{
				menu: await Translate('Open in VSCode'),
				visible: await isVSCodeInstalled(),
				shortcut: 'Shift+Enter',
				icon: 'vscode',
				role: () => {
					reveal(filePath, 'vscode');
				},
			},
			{
				menu: await Translate('Preview'),
				visible: target?.dataset?.isdir !== 'true',
				shortcut: 'Ctrl+O',
				icon: 'preview',
				role: () => Preview(filePath),
			},
		],
		[
			{
				menu: await Translate('Cut'),
				shortcut: 'Ctrl+X',
				icon: 'cut',
				role: () => Cut([filePath]),
			},
			{
				menu: await Translate('Copy'),
				shortcut: 'Ctrl+C',
				icon: 'copy',
				role: () => Copy([filePath]),
			},
			{
				menu: await Translate('Copy Location Path'),
				shortcut: 'Alt+Shift+C',
				icon: 'location',
				role: () => copyLocation(target),
			},
		],
		[
			{
				menu: await Translate('Rename'),
				shortcut: 'F2',
				icon: 'rename',
				role: () => Rename(filePath),
			},
			{
				menu: await Translate('Delete'),
				visible: _focusingPath !== 'xplorer://Trash',
				shortcut: 'Del',
				icon: 'delete',
				role: () => Trash([filePath]),
			},
			{
				menu: await Translate('Restore'),
				icon: 'delete',
				visible: _focusingPath === 'xplorer://Trash',
				role: () => {
					Restore([decodeURI(filePath)]);
				},
			},
			{
				menu: await Translate('Permanently Delete'),
				icon: 'delete',
				visible: _focusingPath === 'xplorer://Trash',
				shortcut: 'Shift+Del',
				role: () => {
					Purge([decodeURI(filePath)]);
				},
			},
			{
				menu: await Translate(isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar'),
				shortcut: 'Alt+P',
				icon: 'pin',
				role: () => Pin([filePath]),
			},
			{
				menu: await Translate('Extract'),
				visible: target?.dataset?.path?.endsWith('.zip') ?? false,
				icon: 'unzip',
				role: async () => {
					const target = await Ask('Extract files', 'Extract files to', { value: filePath.replace('.zip', ''), selectFileName: false });
					new FileAPI(filePath).unzip(target);
				},
			},
			{
				menu: await Translate('Compress to Zip'),
				icon: 'zip',
				role: () => {
					new FileAPI(filePath).zip();
				},
			},
		],
		[
			{
				menu: await Translate('Properties'),
				shortcut: 'Ctrl+P',
				icon: target?.dataset?.isdir ? 'folder setting' : 'file setting',
				role: () => Properties(filePath),
			},
		],
	];
};

export default FileMenu;
