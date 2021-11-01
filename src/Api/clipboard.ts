import { clipboard } from '@tauri-apps/api';

/**
 * Write text into clipboard
 * @param {string} text - Text you want to write to clipboard
 * @returns {void}
 */
const writeTextToClipboard = async (text: string): Promise<void> => {
	return await clipboard.writeText(text);
};

/**
 * Read clipboard text
 * @returns {Promise<string>}
 */
const readTextFromClipboard = async (): Promise<string> => {
	return await clipboard.readText();
};
export { writeTextToClipboard, readTextFromClipboard };
