import { getSelected } from '../../Files/File Operation/select';
import contextMenuItem from '../../../Typings/contextMenuItem';
import vscodeInstalled from '../../Constants/isVSCodeInstalled';
import { createNewTab } from '../../Layout/tab';
import Cut from '../../Files/File Operation/cut';
import Copy from '../../Files/File Operation/copy';
import { Trash } from '../../Files/File Operation/trash';
import Pin from '../../Files/File Operation/pin';

const MultipleSelectedMenu = (
	_: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	return [
		[
			{
				menu: 'Open in new tab',
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
				menu: 'Open in VSCode',
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
				menu: 'Cut',
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
				menu: 'Copy',
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
				menu: 'Delete',
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
				menu: 'Pin to Sidebar',
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
