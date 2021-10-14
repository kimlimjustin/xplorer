import path from 'path';
import folderConfig from '../../Config/folder.config';
import FileConfig from '../../Config/file.config';
/**
 * Get type of a file name
 * @param {string} filename - File name
 * @param {boolean} isDir - is it a directory?
 * @returns {string} File Type
 */
const getType = (filename: string, isDir?: boolean): string => {
	filename = path.basename(filename);
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
	return isDir ? 'File Folder' : `${path.basename(ext).toUpperCase()} file`;
};

export default getType;
