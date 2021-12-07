import FileAPI from '../../Api/files';

const FETCHED_ICONS: string[] = []; // Array of fetch icons

import { isElementInViewport } from './viewport';

/**
 * Load lazy-load image when user open a directory
 * @returns {void}
 */
export const LOAD_IMAGE = (): void => {
	const images = document.querySelectorAll('img[data-src]');
	images.forEach((image: HTMLImageElement) => {
		if (isElementInViewport(image)) {
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
			if (isElementInViewport(image)) {
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
