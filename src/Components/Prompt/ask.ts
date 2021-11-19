import { updateTheme } from '../Theme/theme';
import dragElement from '../Functions/dragElement';
interface AskOptions {
	value: string;
}
/**
 * Prompt a dialog to ask something
 * @param {string} title - Title to display
 * @param {string} message - Message to ask
 * @param {AskOptions} options
 * @returns {any}
 */
const Ask = async (title: string, message: string, options?: AskOptions): Promise<string> => {
	document.querySelectorAll('.prompt').forEach((el) => el.parentNode.removeChild(el));
	const promptElement = document.createElement('div');
	promptElement.className = 'prompt';
	promptElement.innerHTML = `<div class="prompt-frame">
		<span class="prompt-title">${title}</span>
		<span class="prompt-exit-btn"></span>
	</div>
	${message ? `<div class="prompt-message">${message}</div>` : ''}
	<input type="text" class="prompt-input" ${options?.value ? `value=${options?.value}` : ''} />
	<div class="prompt-confirmations">
	<button class="prompt-cancel">Cancel</button>
	<button class="prompt-ok">Ok</button>
	</div>`;
	promptElement.querySelector('.prompt-exit-btn').addEventListener('click', () => promptElement.parentNode.removeChild(promptElement));
	promptElement.querySelector('.prompt-cancel').addEventListener('click', () => promptElement.parentNode.removeChild(promptElement));

	dragElement(promptElement.querySelector('.prompt-frame'), promptElement);
	document.body.appendChild(promptElement);
	updateTheme('prompt');

	const promptInput = promptElement.querySelector<HTMLInputElement>('.prompt-input');
	promptInput.focus();
	promptInput.select();
	return new Promise((resolve) => {
		promptElement.querySelector('.prompt-ok').addEventListener('click', () => {
			promptElement.parentNode.removeChild(promptElement);
			resolve(promptInput.value);
		});
		promptInput.onkeydown = (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				promptElement.parentNode.removeChild(promptElement);
				resolve(promptInput.value);
			}
		};
	});
};

export default Ask;
