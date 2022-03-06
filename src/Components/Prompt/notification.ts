import { pauseEnter } from '../Shortcut/shortcut';
import LogIcon from '../../Icon/notification/log.svg';
import AlertIcon from '../../Icon/notification/alert.svg';
import DebugIcon from '../../Icon/notification/debug.svg';
import InfoIcon from '../../Icon/notification/info.svg';
import WarnIcon from '../../Icon/notification/warn.svg';
const NotificationPrompt = (message: string, notificationType: 'log' | 'alert' | 'debug' | 'info' | 'warn'): Promise<boolean | number> => {
	let notifIcon: string;
	switch (notificationType) {
		case 'log':
			notifIcon = `<img src="${LogIcon}" class="notification-icon">`;
			break;
		case 'alert':
			notifIcon = `<img src="${AlertIcon}" class="notification-icon">`;
			break;
		case 'debug':
			notifIcon = `<img src="${DebugIcon}" class="notification-icon">`;
			break;
		case 'info':
			notifIcon = `<img src="${InfoIcon}" class="notification-icon">`;
			break;
		case 'warn':
			notifIcon = `<img src="${WarnIcon}" class="notification-icon">`;
			break;
	}
	return new Promise<boolean>((resolve) => {
		document.querySelectorAll('.prompt').forEach((el) => el.parentNode.removeChild(el));
		const promptElement = document.createElement('div');
		promptElement.className = 'notification';
		promptElement.innerHTML = `<div class="notification-frame">
		${notifIcon}
        ${message ? `<div class="notification-message">${message}</div>` : ''}
		<span class="notification-exit-btn"></span>
        </div>`;
		promptElement.querySelector('.notification-exit-btn').addEventListener('click', () => {
			promptElement.parentNode.removeChild(promptElement);
			resolve(false);
		});
		const keydownhandler = (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				pauseEnter();
				promptElement.parentNode.removeChild(promptElement);
				document.removeEventListener('keydown', keydownhandler);
				// resolve(defaultValue === 'Yes');
			}
		};
		document.addEventListener('keydown', keydownhandler);
		document.querySelector('.notifications').appendChild(promptElement);
	});
};

export default NotificationPrompt;
