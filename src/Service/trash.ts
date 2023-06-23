import { invoke } from '@tauri-apps/api';
import FileMetaData from '../Typings/fileMetaData';

interface TrashData {
	files: FileMetaData[];
}

interface ReturnInformation {
	status: boolean;
	message: string;
	request_confirmation: boolean;
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
 * @param {boolean} force - Force restore
 * @returns {Promise<ReturnInformation>} - Promise that resolves when files are restored
 */
const RestoreFiles = async (paths: string[], force = false): Promise<ReturnInformation> => {
	return new Promise((resolve) => {
		invoke('restore_files', { paths, force }).then((result) => resolve(result as ReturnInformation));
	});
};

/**
 * Delete files/dirs from trash permanently
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
const PurgeFiles = (paths: string[]): Promise<void> => {
	return new Promise((resolve) => {
		invoke('purge_trashes', { paths }).then(() => resolve());
	});
};

/**
 * Restore a file according with original parent and basename known
 * @param {string} original_parent
 * @param {string} basename
 * @returns {Promise<void>}
 */
const RestoreFile = async (original_parent: string, basename: string): Promise<void> => {
	return await invoke('restore_trash', { originalParent: original_parent, basename });
};

export { getTrashedFiles, DeleteFiles, RestoreFiles, PurgeFiles, RestoreFile };
