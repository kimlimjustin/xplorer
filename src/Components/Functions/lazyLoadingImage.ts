import FileAPI from '../../Service/files';

const FETCHED_ICONS: string[] = []; // Array of fetch icons

/**
 * Check if element in viewport
 * @param {HTMLElement} el - Element to check
 * @returns {boolean} if element in viewport
 */
const isOnImageViewport = (el: HTMLElement): boolean => {
	const rect = el.getBoundingClientRect();
	const windowHeight = window.innerHeight || document.documentElement.clientHeight;
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom - windowHeight <= windowHeight &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
};

/**
 * Load lazy-load image when user open a directory
 * @returns {void}
 */
export const LOAD_IMAGE = (): void => {
	const images = document.querySelectorAll('img[data-src]');
	images.forEach((image: HTMLImageElement) => {
		if (isOnImageViewport(image)) {
			if (image.dataset.isImg === 'true') {
				image.src = new FileAPI(image.dataset.src).readAsset();
			} else {
				image.src = require(`../../Icon/${image.dataset.src}`);
			}
			if (FETCHED_ICONS.indexOf(image.dataset.src) === -1) FETCHED_ICONS.push(image.dataset.src);
			image.removeAttribute('data-src');
		}
	});
};

/**
 * Lazy load initializer, add listener to scrolling event toonly load images when they are visible in viewport
 * @returns {void}
 */
const LAZY_LOAD_INIT = (): void => {
	// Only show image when its visible in viewport to reduce latency
	document.querySelector('.main-box').addEventListener('scroll', () => {
		const images = document.querySelectorAll('img[data-src]');
		images.forEach((image: HTMLImageElement) => {
			if (isOnImageViewport(image)) {
				if (image.dataset.isImg === 'true') {
					image.src = new FileAPI(image.dataset.src).readAsset();
				} else {
					image.src = require(`../../Icon/${image.dataset.src}`);
				}
				if (FETCHED_ICONS.indexOf(image.dataset.src) === -1) FETCHED_ICONS.push(image.dataset.src);
				image.removeAttribute('data-src');
			}
		});
	});
};

export default LAZY_LOAD_INIT;
