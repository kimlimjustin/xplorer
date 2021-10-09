import { open } from '../../Files/File Operation/open';
import { createNewTab } from '../../Layout/tab';
import contextMenuItem from '../../../Typings/contextMenuItem';

const SidebarDriveMenu = (
	target: HTMLElement,
	filePath: string
): contextMenuItem[][] => {
	console.log(filePath);
	return [
		[
			{
				menu: 'Open',
				icon: 'open',
				role: () => {
					open(filePath);
				},
			},
			{
				menu: 'Open in new tab',
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
