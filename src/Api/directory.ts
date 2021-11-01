import joinPath from '../Components/Functions/path/joinPath';
import normalizeSlash from '../Components/Functions/path/normalizeSlash';
import { invoke } from '@tauri-apps/api';

interface SystemTime {
	nanos_since_epoch: number;
	secs_since_epoch: number;
}
interface FileMetaData {
	file_path: string;
	basename: string;
	is_dir: boolean;
	is_hidden: boolean;
	is_file: boolean;
	is_system: boolean;
	size: number;
	readonly: boolean;
	last_modified: SystemTime;
	last_accessed: SystemTime;
	created: SystemTime;
}
interface DirectoryData {
	files: FileMetaData[];
	number_of_files: number;
	skipped_files: string[];
}
/**
 * Invoke Rust command to read information of a directory
 */
class DirectoryAPI {
	readonly dirName: string;
	readonly parentDir: string;
	files: FileMetaData[];
	constructor(dirName: string, parentDir?: string) {
		if (parentDir) {
			this.parentDir = normalizeSlash(parentDir);
			this.dirName = normalizeSlash(joinPath(parentDir, dirName));
		} else this.dirName = normalizeSlash(dirName);
	}
	/**
	 * Get files inside a directory
	 * @returns {Promise<DirectoryData>}
	 */
	getFiles(): Promise<DirectoryData> {
		return new Promise((resolve) => {
			invoke('read_directory', { dir: this.dirName }).then(
				(files: DirectoryData) => {
					this.files = files.files;
					resolve(files);
				}
			);
		});
	}
	/**
	 * Check if given path is directory
	 * @returns {Promise<boolean>}
	 */
	async isDir(): Promise<boolean> {
		return new Promise((resolve) => {
			invoke('is_dir', { path: this.dirName }).then((result: boolean) =>
				resolve(result)
			);
		});
	}
	/**
	 * Return true if folder exist
	 * @returns {boolean}
	 */
	async exists(): Promise<boolean> {
		return await invoke('file_exist', { filePath: this.dirName });
	}
	/**
	 * Create dir if not exists
	 * @returns {any}
	 */
	async mkdir(): Promise<boolean> {
		return await invoke('create_dir_recursive', {
			dirPath: this.dirName,
		});
	}

	listen(): void {
		null;
	}
}

export default DirectoryAPI;
export { FileMetaData };
