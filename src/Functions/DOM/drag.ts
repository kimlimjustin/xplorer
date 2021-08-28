import { ipcRenderer } from 'electron';
import path from 'path';

/**
 * Handle native drag between windows
 * @param {NodeListOf<Element>} elements - elements to be listened to
 * @param {string} srcPath - base path of the element
 * @returns {void}
 */
const nativeDrag = (elements: NodeListOf<Element>, srcPath: string): void => {
	elements.forEach((file) => {
		(file as HTMLElement).ondragstart = (e) => {
			e.preventDefault();
			ipcRenderer.send(
				'ondragstart',
				path.join(
					srcPath,
					file.querySelector<HTMLElement>('#file-filename').innerText
				),
				{ isDir: (file as HTMLElement).dataset.isdir == 'true' }
			);
		};
	});
};

export default nativeDrag;
