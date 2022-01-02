import Storage from '../../../Service/storage';
/**
 * Copy (a) file/s
 *
 * @param {Array<string>} files - Array of file paths.
 * @returns {void}
 */
const Copy = (files: Array<string>): void => {
	Storage.set('clipboard', { command: 'cp', files: files });
};

export default Copy;
