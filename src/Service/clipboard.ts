import isTauri from '../Util/is-tauri';

/**
 * Write text into clipboard
 * @param {string} text - Text you want to write to clipboard
 * @returns {void}
 */
const writeTextToClipboard = async (text: string): Promise<void> => {
	if (isTauri) {
		const { clipboard } = require('@tauri-apps/api');
		return await clipboard.writeText(text);
	} else {
		return await navigator.clipboard.writeText(text);
	}
};

/**
 * Read clipboard text
 * @returns {Promise<string>}
 */
const readTextFromClipboard = async (): Promise<string> => {
	if (isTauri) {
		const { clipboard } = require('@tauri-apps/api');
		return await clipboard.readText();
	} else {
		return await navigator.clipboard.readText();
	}
};
export { writeTextToClipboard, readTextFromClipboard };
