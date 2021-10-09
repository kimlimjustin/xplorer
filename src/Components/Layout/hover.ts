import path from 'path';
import { IMAGE_TYPES } from '../Constants/fileTypes';

/**
 * Listen to mouse hovering
 * @returns {void}
 */
const Hover = (): void => {
	let timeOut: number;
	let displayName: string;
	let hoveringElement: HTMLElement;
	const hoverPreviewElement = document.createElement('div');

	document.querySelector('#workspace').addEventListener('mousemove', (e) => {
		const x = (e as MouseEvent).clientX;
		const y = (e as MouseEvent).clientY;
		window.clearTimeout(timeOut);
		hoverPreviewElement?.parentNode?.removeChild(hoverPreviewElement);

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

		if (!filenameGrid) return;

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

			if (
				IMAGE_TYPES.indexOf(path.extname(filenameGrid.innerHTML)) !== -1
			) {
				hoverPreviewElement.innerHTML = `<img src="${unescape(
					target.dataset.path
				)}">`;
				hoverPreviewElement.classList.add('hover-preview');
				hoverPreviewElement.style.top = y + 'px';
				hoverPreviewElement.style.left = x + 'px';
				hoverPreviewElement.dataset.path = target.dataset.path;
				document.body.appendChild(hoverPreviewElement);
			}
		}, 500);
	});
};

export default Hover;
