import { getSelected } from '../../Files/File Operation/select';
import contextMenuItem from '../../../Typings/contextMenuItem';
import vscodeInstalled from '../../Constants/isVSCodeInstalled';
import { createNewTab } from '../../Layout/tab';
import Cut from '../../Files/File Operation/cut';
import Copy from '../../Files/File Operation/copy';
import { Trash } from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';
import Translate from '../../I18n/i18n';

const MultipleSelectedMenu = (
	_: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	return [
		[
			{
				menu: Translate('Open in New Tab'),
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
				menu: Translate('Open in VSCode'),
				role: () => {
					const os = require('os');
					const { exec } = require('child_process');
					for (const element of getSelected()) {
						const selectedPath = unescape(element.dataset.path);
						if (
							process.platform === 'linux' &&
							filePath === 'xplorer://Home'
						)
							exec(`code ${os.homedir()}`);
						else
							exec(
								`code "${selectedPath.replaceAll('"', '\\"')}"`
							);
					}
				},
				shortcut: 'Shift+Enter',
				visible: vscodeInstalled,
				icon: 'vscode',
			},
		],
		[
			{
				menu: Translate('Cut'),
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
				menu: Translate('Copy'),
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
				menu: Translate('Delete'),
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
				menu: Translate('Pin to Sidebar'),
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
