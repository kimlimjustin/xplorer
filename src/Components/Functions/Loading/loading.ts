/**
 * start the loading animation
 * @returns {void}
 */
const startLoading = (): void => {
	const LOADING_BAR = document.querySelector<HTMLElement>('.loading-bar');
	LOADING_BAR.dataset.loading = 'true';
};

/**
 * Stop the loading animation
 * @returns {void}
 */
const stopLoading = (): void => {
	const LOADING_BAR = document.querySelector<HTMLElement>('.loading-bar');
	LOADING_BAR.dataset.loading = 'false';
};

export { startLoading, stopLoading };
