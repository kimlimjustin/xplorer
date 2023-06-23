import Storage from '../../../Service/storage';
/**
 * Cut (a) file/s
 *
 * @param {Array<string>} files - Array of file paths.
 * @returns {any}
 */
const Cut = (files: Array<string>): void => {
	Storage.set('clipboard', { command: 'cut', files: files });
	for (const file of files) {
		document.querySelector(`.file[data-path="${encodeURI(file)}"]`).classList.add('cut');
	}

	(async function detectClipboardChange() {
		let n: NodeJS.Timeout; //eslint-disable-line
		if ((await Storage.get('clipboard')).files !== files) {
			global.clearTimeout(n);
			document.querySelectorAll<HTMLElement>('.file.cut').forEach((file) => {
				if (files.indexOf(decodeURI(file.dataset.path)) !== -1) {
					file.classList.remove('cut');
				}
			});
			return;
		}
		n = setTimeout(detectClipboardChange, 100);
	})();
	return;
};

export default Cut;
