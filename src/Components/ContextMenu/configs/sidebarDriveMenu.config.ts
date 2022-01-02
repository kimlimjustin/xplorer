import { OpenDir } from '../../Open/open';
import { createNewTab } from '../../Layout/tab';
import contextMenuItem from '../../../Typings/contextMenuItem';
import Translate from '../../I18n/i18n';
import FileAPI from '../../../Service/files';

const SidebarDriveMenu = async (target: HTMLElement, filePath: string): Promise<contextMenuItem[][]> => {
	return [
		[
			{
				menu: await Translate('Open'),
				icon: 'open',
				role: () => {
					target?.dataset?.isdir === 'true' ? OpenDir(filePath) : new FileAPI(filePath).openFile();
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
		],
	];
};

export default SidebarDriveMenu;
