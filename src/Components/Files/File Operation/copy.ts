import { clipboard } from 'electron';
/**
 * Copy (a) file/s
 *
 * @param {Array<string>} files - Array of file paths.
 * @returns {void}
 */
const Copy = (files: Array<string>): void => {
	if (process.platform === 'linux') {
		let commands = `Xplorer command - COPY`;
		for (const file of files) {
			commands += '\n' + file;
		}
		clipboard.writeText(commands);
	} else {
		const clipboardEx = require('electron-clipboard-ex'); //eslint-disable-line
		clipboardEx.writeFilePaths(files);
	}
	return;
};

export default Copy;
