import beep from '../Functions/beep';
import dragElement from '../Functions/dragElement';
import { ErrorLog } from '../Functions/log';
const PromptError = (title: string, message: string): void => {
	document.querySelectorAll('.prompt').forEach((el) => el.parentNode.removeChild(el));
	const promptElement = document.createElement('div');
	promptElement.className = 'prompt';
	promptElement.innerHTML = `<div class="prompt-frame">
    <span class="prompt-title">${title}</span>
    <span class="prompt-exit-btn"></span>
    </div>
    ${message ? `<div class="prompt-message">${message}</div>` : ''}
	<div class="prompt-confirmations">
    <button class="prompt-ok">Ok</button>
    </div>`;
	promptElement.querySelector('.prompt-ok').addEventListener('click', () => promptElement.parentNode.removeChild(promptElement));
	document.body.appendChild(promptElement);
	beep();
	dragElement(promptElement.querySelector('.prompt-frame'), promptElement);
	ErrorLog(`[${title}] ${message}`);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			promptElement.parentNode.removeChild(promptElement);
		}
	});
};

export default PromptError;
