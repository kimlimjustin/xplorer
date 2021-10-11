import { open } from '../../Files/File Operation/open';
import { createNewTab } from '../../Layout/tab';
import contextMenuItem from '../../../Typings/contextMenuItem';
import Translate from '../../I18n/i18n';

const SidebarDriveMenu = (
	target: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	return [
		[
			{
				menu: Translate('Open'),
				icon: 'open',
				role: () => {
					open(filePath);
				},
			},
			{
				menu: Translate('Open in New Tab'),
				visible: target?.dataset?.isdir === 'true',
				icon: 'open in new tab',
				role: () => {
					createNewTab(filePath);
				},
			},
		],
	];
};

export default SidebarDriveMenu;
