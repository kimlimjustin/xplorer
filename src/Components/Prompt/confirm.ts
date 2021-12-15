import dragElement from '../Functions/dragElement';
import { pauseEnter } from '../Shortcut/shortcut';

const ConfirmDialog = (title: string, message: string, defaultValue?: 'Yes' | 'No'): Promise<boolean> => {
	return new Promise<boolean>((resolve) => {
		document.querySelectorAll('.prompt').forEach((el) => el.parentNode.removeChild(el));
		const promptElement = document.createElement('div');
		promptElement.className = 'prompt';
		promptElement.innerHTML = `<div class="prompt-frame">
		<span class="prompt-title">${title}</span>
		<span class="prompt-exit-btn"></span>
        </div>
        ${message ? `<div class="prompt-message">${message}</div>` : ''}
        <div class="prompt-confirmations">
        <button class="prompt-cancel">No</button>
        <button class="prompt-ok">Yes</button>
        </div>`;
		promptElement.querySelector('.prompt-exit-btn').addEventListener('click', () => {
			promptElement.parentNode.removeChild(promptElement);
			resolve(false);
		});
		promptElement.querySelector('.prompt-cancel').addEventListener('click', () => {
			promptElement.parentNode.removeChild(promptElement);
			resolve(false);
		});
		promptElement.querySelector('.prompt-ok').addEventListener('click', () => {
			promptElement.parentNode.removeChild(promptElement);
			resolve(true);
		});
		dragElement(promptElement.querySelector('.prompt-frame'), promptElement);
		const keydownhandler = (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				pauseEnter();
				promptElement.parentNode.removeChild(promptElement);
				document.removeEventListener('keydown', keydownhandler);
				resolve(defaultValue === 'Yes');
			}
		};
		document.addEventListener('keydown', keydownhandler);
		document.body.appendChild(promptElement);
	});
};

export default ConfirmDialog;
