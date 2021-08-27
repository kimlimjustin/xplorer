import clipboardy from 'clipboardy';
/**
 * Cut (a) file/s
 *
 * Make the file path(s) as a command string and copy into clipboard and use it then while pasting file
 *
 * @param {Array<string>} files - Array of file paths.
 * @returns {any}
 */
const Cut = (files: Array<string>): void => {
	let commands = `Xplorer command - CUT`;
	for (const file of files) {
		commands += '\n' + file;
		document
			.querySelector(`.file[data-path="${escape(file)}"]`)
			.classList.add('cut');
	}
	clipboardy.writeSync(commands);

	/*(function detectClipboardChange() {
		if (clipboardy.readSync() !== commands) {
			clearTimeout(detectClipboardChange);
			document
				.querySelectorAll<HTMLElement>('.file.cut')
				.forEach((file) => {
					if (files.indexOf(escape(file.dataset.path)) !== -1)
						file.classList.remove('cut');
				});
			return;
		}
		setTimeout(detectClipboardChange, 100);
	})();*/
	return;
};

export default Cut;