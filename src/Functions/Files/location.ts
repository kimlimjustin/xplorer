import clipboardy from 'clipboardy';
/**
 * Copy file location from file element into clipborad
 * @param {HTMLElement} element - file element
 * @returns {void}
 */
const copyLocation = (element: HTMLElement): void => {
	const path = unescape(element.dataset.path);
	clipboardy.writeSync(path);
};

export default copyLocation;
