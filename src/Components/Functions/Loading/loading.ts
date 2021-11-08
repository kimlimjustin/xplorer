/**
 * start the loading animation
 * @returns {void}
 */
const startLoading = (): void => {
	const LOADING_BAR = document.querySelector<HTMLElement>('.loading-bar');
	LOADING_BAR.dataset.loading = 'true';
};
/**
 * Check if the loading animation is running
 * @returns {any}
 */
const isLoading = (): boolean => {
	const LOADING_BAR = document.querySelector<HTMLElement>('.loading-bar');
	return LOADING_BAR.dataset.loading === 'true';
};

/**
 * Stop the loading animation
 * @returns {void}
 */
const stopLoading = (): void => {
	const LOADING_BAR = document.querySelector<HTMLElement>('.loading-bar');
	LOADING_BAR.dataset.loading = 'false';
};

export { startLoading, stopLoading, isLoading };
