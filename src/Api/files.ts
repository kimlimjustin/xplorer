import { fs, invoke, tauri } from '@tauri-apps/api';
import joinPath from '../Components/Functions/path/joinPath';
import dirname from '../Components/Functions/path/dirname';
import FileMetaData from '../Typings/fileMetaData';

/** Invoke Rust command to handle files */
class FileAPI {
	readonly fileName: string;
	readonly parentDir: string;
	/**
	 * Construct FileAPI Class
	 * @param {string} fileName - Your file path
	 * @param {string} parentDir - Parent directory of the file
	 */
	constructor(fileName: string, parentDir?: string) {
		if (parentDir) {
			this.parentDir = parentDir;
			this.fileName = joinPath(parentDir, fileName);
		} else this.fileName = fileName;
	}
	/**
	 * Read text file
	 * @returns {Promise<any>}
	 */
	readFile(): Promise<string> {
		return new Promise((resolve) => {
			fs.readTextFile(this.fileName).then((fileContent) => resolve(fileContent));
		});
	}

	async readBuffer(): Promise<Buffer> {
		const Buffer = require('buffer/').Buffer;
		return Buffer.from(await fs.readBinaryFile(this.fileName));
	}
	/**
	 * Open file on default app
	 * @returns {Promise<void>}
	 */
	async openFile(): Promise<void> {
		return await invoke('open_file', { filePath: this.fileName });
	}
	/**
	 * Get tauri url of local assets
	 * @returns {string}
	 */
	readAsset(): string {
		return tauri.convertFileSrc(this.fileName);
	}
	/**
	 * Read file and return as JSON
	 * @returns {Promise<JSON>}
	 */
	async readJSONFile(): Promise<JSON> {
		const content = await this.readFile();
		return JSON.parse(content);
	}

	/**
	 * Return true if file exist
	 * @returns {boolean}
	 */
	async exists(): Promise<boolean> {
		return await invoke('file_exist', { filePath: this.fileName });
	}
	/**
	 * Create file if it doesn't exist
	 * @returns {Promise<void>}
	 */
	async createFile(): Promise<void> {
		await invoke('create_dir_recursive', {
			dirPath: dirname(this.fileName),
		});
		return await invoke('create_file', { filePath: this.fileName });
	}
	/**
	 * Read properties of a file
	 * @returns {Promise<FileMetaData>}
	 */
	async properties(): Promise<FileMetaData> {
		return await invoke('get_file_properties', { filePath: this.fileName });
	}

	/**
	 * Check if given path is directory
	 * @returns {Promise<boolean>}
	 */
	async isDir(): Promise<boolean> {
		return new Promise((resolve) => {
			invoke('is_dir', { path: this.fileName }).then((result: boolean) => resolve(result));
		});
	}

	async extractIcon(): Promise<string> {
		return await invoke('extract_icon', { filePath: this.fileName });
	}
}

export default FileAPI;
