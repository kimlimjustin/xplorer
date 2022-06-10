import { getCurrent } from '@tauri-apps/api/window';
import type { ConsoleMessage, ExtensionMessage, InfobarMessage } from '../Typings/extensions';
import Notification from '../Components/Prompt/notification';
import { addExtendedMenu } from '../Components/ContextMenu/contextMenu';
import { UpdateInfo } from '../Components/Layout/infobar';

const Extensions = () => {
	getCurrent().listen('alert', (message) => {
		Notification(message.payload as unknown as string, 'alert');
	});
	getCurrent().listen('console', (message: { payload: ConsoleMessage }) => {
		if (message.payload.level === 1) {
			Notification(message.payload.message, 'log');
		} else if (message.payload.level === 2) {
			Notification(message.payload.message, 'debug');
		} else if (message.payload.level === 4) {
			Notification(message.payload.message, 'info');
		} else if (message.payload.level === 8) {
			Notification(message.payload.message, 'alert');
		} else if (message.payload.level === 16) {
			Notification(message.payload.message, 'warn');
		}
	});
	getCurrent().listen('extensions', (message: { payload: ExtensionMessage }) => {
		switch (message.payload.message_type) {
			case 'contextmenu_addmenu':
				addExtendedMenu([message.payload.message]);
				break;
			case 'contextmenu_addgroupmenu':
				addExtendedMenu(message.payload.message);
				break;
		}
	});
	getCurrent().listen('infobar', (msg: { payload: InfobarMessage }) => {
		UpdateInfo(msg.payload.infobar_key, msg.payload.new_value);
	});
};

export default Extensions;
