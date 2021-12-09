/**
 * Check if element in viewport
 * @param {HTMLElement} el - Element to check
 * @returns {boolean} if element in viewport
 */
const isElementInViewport = (el: HTMLElement): boolean => {
	const rect = el.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
};

/**
 * Ensure an element in view port
 * @param {HTMLElement} element - element you want to ensure
 * @returns {void}
 */
const ensureElementInViewPort = (element: HTMLElement): void => {
	if (!isElementInViewport(element)) element.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

export { ensureElementInViewPort };
