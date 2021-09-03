import { clipboard } from 'electron';
/**
 * Copy file location from file element into clipborad
 * @param {HTMLElement} element - file element
 * @returns {void}
 */
const copyLocation = (element: HTMLElement): void => {
	const path = unescape(element.dataset.path);
	clipboard.writeText(path);
};

export default copyLocation;
