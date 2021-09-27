import storage from 'electron-json-storage-sync';
const lazy_load_frequency =
	storage.get('preference')?.data?.lazyLoadFrequency || 500;
const FETCHED_ICONS: string[] = []; // Array of fetch icons

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
		rect.bottom <=
			(window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <=
			(window.innerWidth || document.documentElement.clientWidth)
	);
};

/**
 * Load images only when the images appear on user viewport
 * @returns {void}
 */
const LAZY_LOAD = (): void => {
	const MAIN_ELEMENT = document.getElementById('workspace');
	// Only show image when its visible in viewport to reduce latency
	MAIN_ELEMENT.querySelectorAll('img').forEach((img) => {
		(function _detectImg() {
			let n: NodeJS.Timeout; //eslint-disable-line
			if (img.dataset.src) {
				if (isElementInViewport(img)) {
					img.src = img.dataset.src;
					if (FETCHED_ICONS.indexOf(img.dataset.src) === -1)
						FETCHED_ICONS.push(img.dataset.src);
					img.removeAttribute('data-src');
					global.clearTimeout(n);
				} else {
					// Directly show icons if it was fetched before
					if (FETCHED_ICONS.indexOf(img.dataset.src) !== -1) {
						img.src = img.dataset.src;
						global.clearTimeout(n);
					}
				}
			}
			n = setTimeout(_detectImg, lazy_load_frequency);
		})();
	});
};

export default LAZY_LOAD;
