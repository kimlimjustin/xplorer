import { invoke } from '@tauri-apps/api';
import { copyFile, renameFile } from '@tauri-apps/api/fs';
/**
 * Invoke Rust command to operate files/dirs
 */
class OperationAPI {
	readonly src: string;
	readonly dest: string;
	constructor(src: string, dest: string) {
		this.src = src;
		this.dest = dest;
	}
	/**
	 * Copy files/dirs
	 * @returns {Promise<void>}
	 */
	async copyFile(): Promise<void> {
		return await copyFile(this.src, this.dest);
	}
	/**
	 * Rename file/dir
	 * @returns {any}
	 */
	async rename(): Promise<void> {
		return await renameFile(this.src, this.dest);
	}
}
export default OperationAPI;
