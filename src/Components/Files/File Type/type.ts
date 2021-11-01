import folderConfig from '../../../Config/folder.config';
import FileConfig from '../../../Config/file.config';
import basename from '../../Functions/path/basename';
/**
 * Get type of a file name
 * @param {string} filename - File name
 * @param {boolean} isDir - is it a directory?
 * @returns {string} File Type
 */
const getType = (filename: string, isDir?: boolean): string => {
	filename = basename(filename);
	const ext = filename.split('.').pop().toLowerCase();
	// Prioritize exact file name and folder name over file extension
	for (const type of FileConfig()) {
		if (
			type.fileNames?.indexOf(filename) !== undefined &&
			type.fileNames?.indexOf(filename) !== -1 &&
			type.type
		) {
			return type.type;
		}
	}
	for (const type of folderConfig()) {
		if (
			type.folderNames?.indexOf(filename) !== undefined &&
			type.folderNames?.indexOf(filename) !== -1 &&
			type.type
		) {
			return type.type;
		}
	}
	for (const type of FileConfig()) {
		if (
			type.extension?.indexOf(ext) !== undefined &&
			type.extension?.indexOf(ext) !== -1
		) {
			return type.type;
		}
	}
	return isDir
		? 'File Folder'
		: `${filename.split('.').pop().toUpperCase()} file`;
};

export default getType;
