import {
	FILE_TYPES_AVAILABLE_FOR_PREVIEW,
	Preview,
} from '../../Files/File Preview/preview';
import contextMenuItem from '../../../Typings/contextMenuItem';
import path from 'path';
import { createNewTab } from '../../Layout/tab';
import Pin from '../../Files/File Operation/pin';
import { open } from '../../Files/File Operation/open';

const SidebarMenu = (
	target: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	return [
		[
			{ menu: 'Open', icon: 'open', role: () => open(filePath) },
			{
				menu: 'Open in new tab',
				visible: target?.dataset?.isdir === 'true',
				icon: 'open in new tab',
				role: () => {
					createNewTab(filePath);
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
				role: () => {
					Preview(filePath);
				},
			},
		],
		[
			{
				menu: 'Unpin from Sidebar',
				icon: 'pin',
				role: () => {
					Pin([filePath]);
				},
			},
		],
	];
};

export default SidebarMenu;
