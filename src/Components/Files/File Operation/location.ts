import { writeTextToClipboard } from '../../../Service/clipboard';

/**
 * Copy file location from file element into clipborad
 * @param {HTMLElement} element - file element
 * @returns {void}
 */
const copyLocation = (element: HTMLElement): void => {
	const path = decodeURI(element.dataset.path);
	writeTextToClipboard(path);
};

export default copyLocation;
