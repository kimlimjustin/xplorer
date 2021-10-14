import contextMenuItem from '../../../Typings/contextMenuItem';
import { createNewTab } from '../../Layout/tab';
import Pin from '../../Files/File Operation/pin';
import { open } from '../../Files/File Operation/open';
import Translate from '../../I18n/i18n';
import { Preview } from '../../Files/File Preview/preview';

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
				shortcut: 'Ctrl+O',
				visible: target?.dataset?.isdir !== 'true',
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
