import { dialog } from '@electron/remote';
import path from 'path';
import { updateTheme } from '../../Theme/theme';
import FileTypesConfig from '../Types/fileTypes';

/**
 * Close the preview file
 * @returns {void}
 */
const closePreviewFile = (): void => {
	document.getElementById('workspace').classList.remove('workspace-split');
	document
		.querySelectorAll('.preview')
		.forEach((element) => element.parentNode.removeChild(element));
	document.querySelector<HTMLElement>('.main-box').style.overflowY = 'auto';
};
/**
 * Show preview file
 * @param {string} filePath - file to preview
 * @returns {void}
 */
const Preview = (filePath: string): void => {
	closePreviewFile();
	const previewElement = document.createElement('div');
	previewElement.classList.add('preview');

	const changePreview = (html: string) => {
		if (!html) return;
		previewElement.innerHTML = `
                <div class="preview-header">
                    <span class="preview-path">${path.basename(filePath)}</span>
                    <span class="preview-exit-btn">&times;</span>
                </div>
                ${html}
                `;

		document.querySelector<HTMLElement>('.main-box').scrollTop = 0;
		document.querySelector<HTMLElement>('.main-box').style.overflowY =
			'hidden';
		document
			.getElementById('workspace')
			.classList.toggle('workspace-split');
		document.querySelector('.main-box').appendChild(previewElement);
		previewElement
			.querySelector('.preview-exit-btn')
			.addEventListener('click', () => closePreviewFile());
	};

	const ext = filePath.split('.').pop().toLowerCase();
	const basename = path.basename(filePath);
	let previewed = false;
	for (const type of FileTypesConfig()) {
		if (
			(type.fileNames?.indexOf(basename) !== undefined &&
				type.fileNames?.indexOf(basename) !== -1) ||
			(type.folderNames?.indexOf(basename) !== undefined &&
				type.folderNames?.indexOf(basename) !== -1)
		) {
			type?.preview?.(filePath, (html) => changePreview(html));
			previewed = true;
		}
	}
	for (const type of FileTypesConfig()) {
		if (
			type.extension?.indexOf(ext) !== undefined &&
			type.extension?.indexOf(ext) !== -1
		) {
			type?.preview?.(filePath, (html) => changePreview(html));
			previewed = true;
		}
	}
	if (!previewed)
		dialog.showErrorBox(
			'No preview handler',
			'There is no preview handler for this file type yet.'
		);
	updateTheme();
};

export { Preview, closePreviewFile };
