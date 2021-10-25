import { fs, invoke, tauri } from '@tauri-apps/api';
/** Invoke Rust command to handle files */
class FileAPI {
	readonly fileName: string;
	/**
	 * Construct FileAPI Class
	 * @param {string} fileName - Your file path
	 */
	constructor(fileName: string) {
		this.fileName = fileName;
	}
	/**
	 * Read text file
	 * @returns {Promise<any>}
	 */
	readFile(): Promise<string> {
		return new Promise((resolve) => {
			fs.readTextFile(this.fileName).then((fileContent) =>
				resolve(fileContent)
			);
		});
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
}

export default FileAPI;
