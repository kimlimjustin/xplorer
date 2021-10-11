import {
	FILE_TYPES_AVAILABLE_FOR_PREVIEW,
	Preview,
} from '../../Files/File Preview/preview';
import contextMenuItem from '../../../Typings/contextMenuItem';
import path from 'path';
import { createNewTab } from '../../Layout/tab';
import Pin from '../../Files/File Operation/pin';
import { open } from '../../Files/File Operation/open';
import Translate from '../../I18n/i18n';

const SidebarMenu = (
	target: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	return [
		[
			{
				menu: Translate('Open'),
				icon: 'open',
				role: () => open(filePath),
			},
			{
				menu: Translate('Open in New Tab'),
				visible: target?.dataset?.isdir === 'true',
				icon: 'open in new tab',
				role: () => {
					createNewTab(filePath);
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
				role: () => {
					Preview(filePath);
				},
			},
		],
		[
			{
				menu: Translate('Unpin from Sidebar'),
				icon: 'pin',
				role: () => {
					Pin([filePath]);
				},
			},
		],
	];
};

export default SidebarMenu;
