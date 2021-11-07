import joinPath from '../Components/Functions/path/joinPath';
import normalizeSlash from '../Components/Functions/path/normalizeSlash';
import { invoke } from '@tauri-apps/api';
import type FileMetaData from '../Typings/fileMetaData';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let interval: any;
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
	private _files: string[] = [];
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
			invoke('read_directory', { dir: this.dirName }).then((files: DirectoryData) => {
				this.files = files.files;
				resolve(files);
			});
		});
	}
	/**
	 * Check if given path is directory
	 * @returns {Promise<boolean>}
	 */
	async isDir(): Promise<boolean> {
		return new Promise((resolve) => {
			invoke('is_dir', { path: this.dirName }).then((result: boolean) => resolve(result));
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

	/**
	 * Listen to changes in a directory
	 * @param {() => void} cb - callback
	 * @returns {any}
	 */
	async listen(cb: () => void): Promise<void> {
		clearInterval(interval);
		this._files = await invoke('get_files_in_directory', { dir: this.dirName });
		interval = setInterval(
			async () => {
				const files = (await invoke('get_files_in_directory', { dir: this.dirName })) as string[];
				if (JSON.stringify(files) !== JSON.stringify(this._files)) {
					console.log('a');
					cb();
				}
				this._files = files;
			},
			this._files.length > 200 ? this._files.length * 5 : 500
		);
	}
}

export default DirectoryAPI;
