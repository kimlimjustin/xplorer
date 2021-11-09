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
		invoke('get_trashed_items').then((result) => resolve(result as TrashData));
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

/**
 * Restore files/dirs from trash
 * @param {string[]} paths - Paths to be restored
 * @returns {Promise<void>} - Promise that resolves when files are restored
 */
const RestoreFiles = (paths: string[]): Promise<void> => {
	return new Promise((resolve) => {
		invoke('restore_files', { paths }).then(() => resolve());
	});
};

const PurgeFiles = (paths: string[]): Promise<void> => {
	return new Promise((resolve) => {
		invoke('purge_trashes', { paths }).then(() => resolve());
	});
};

const RestoreFile = (original_parent: string, basename: string): Promise<void> => {
	return new Promise((resolve) => {
		invoke('restore_trash', { originalParent: original_parent, basename }).then(() => resolve());
	});
};

export { getTrashedFiles, DeleteFiles, RestoreFiles, PurgeFiles, RestoreFile };
