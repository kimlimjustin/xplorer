import path from 'path';
/**
 * Listen to mouse hovering
 * @returns {void}
 */
const Hover = (): void => {
	let timeOut: number;
	let displayName: string;
	let hoveringElement: HTMLElement;

	document.querySelector('#workspace').addEventListener('mousemove', (e) => {
		window.clearTimeout(timeOut);

		// Ignore workspace hovering
		if ((e.target as HTMLElement).id === 'workspace') {
			if (hoveringElement?.dataset?.path && displayName)
				hoveringElement.querySelector('.file-grid-filename').innerHTML =
					displayName;
			return;
		}
		hoveringElement?.classList?.remove('hovering');

		const target = (e.target as HTMLElement)?.dataset?.path
			? (e.target as HTMLElement)
			: ((e.target as HTMLElement)?.parentNode as HTMLElement);

		const filenameGrid = target.querySelector('.file-grid-filename');

		if (target !== hoveringElement) {
			displayName = undefined;
		}
		hoveringElement = target;

		timeOut = window.setTimeout(() => {
			displayName = filenameGrid.innerHTML;
			filenameGrid.innerHTML = path.basename(
				unescape(target.dataset.path)
			);
			target?.classList?.add('hovering');
		}, 1500);
	});
};

export default Hover;
