import { clipboard } from '@tauri-apps/api';

/**
 * Write text into clipboard
 * @param {string} text - Text you want to write to clipboard
 * @returns {void}
 */
export const writeTextToClipboard = async (text: string): Promise<void> => clipboard.writeText(text);

/**
 * Read clipboard text
 * @returns {Promise<string>}
 */
export const readTextFromClipboard = async (): Promise<string> => clipboard.readText();
