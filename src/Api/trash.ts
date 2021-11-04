import { invoke } from '@tauri-apps/api';
import FileMetaData from '../Typings/fileMetaData';

interface TrashData {
	files: FileMetaData[];
}
/**
 * Get list of files in trash
 *
 * @returns {Promise<TrashData>}
 */
const getTrashedFiles = (): Promise<TrashData> => {
	return new Promise((resolve) => {
		invoke('get_trashed_items').then((result) =>
			resolve(result as TrashData)
		);
	});
};

/**
 * Move files/dirs to trash
 * @param {string} paths - Paths to be deleted
 * @returns {Promise<void>}
 */
const DeleteFiles = (paths: string[]): Promise<void> => {
	return new Promise((resolve) => {
		invoke('delete_file', { paths }).then(() => resolve());
	});
};

export { getTrashedFiles, DeleteFiles };
