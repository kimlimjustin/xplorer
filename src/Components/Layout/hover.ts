import FileAPI from '../../Api/files';
import { IMAGE_TYPES } from '../../Config/file.config';
import getBasename from '../Functions/path/basename';

const getExtension = (filename: string): string => {
	const basename = getBasename(filename);
	const index = basename.lastIndexOf('.');
	if (index === -1) {
		return '';
	}
	return basename.substr(index + 1);
};
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

		const focusingPath = document.querySelector<HTMLInputElement>('.path-navigator').value;

		// Ignore workspace hovering
		if ((e.target as HTMLElement).id === 'workspace') {
			if (hoveringElement?.dataset?.path && displayName) hoveringElement.querySelector('.file-grid-filename').innerHTML = displayName;
			return;
		}
		hoveringElement?.classList?.remove('hovering');

		const target = (e.target as HTMLElement)?.dataset?.path ? (e.target as HTMLElement) : ((e.target as HTMLElement)?.parentNode as HTMLElement);

		const filenameGrid = target.querySelector('.file-grid-filename');

		if (!filenameGrid) return;

		if (target !== hoveringElement) {
			displayName = undefined;
		}
		hoveringElement = target;

		timeOut = window.setTimeout(() => {
			displayName = filenameGrid.innerHTML;
			const path = focusingPath === 'xplorer://Trash' ? unescape(target.dataset.realPath) : unescape(target.dataset.path);
			filenameGrid.innerHTML = getBasename(path);
			target?.classList?.add('hovering');

			if (IMAGE_TYPES.indexOf(getExtension(filenameGrid.innerHTML)) !== -1) {
				hoverPreviewElement.innerHTML = `<img src="${new FileAPI(path).readAsset()}">`;
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
