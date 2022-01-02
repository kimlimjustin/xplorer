import { copyFile, renameFile, removeDir, removeFile } from '@tauri-apps/api/fs';
import DirectoryAPI from './directory';
/**
 * Invoke Rust command to operate files/dirs
 */
class OperationAPI {
	readonly src: string;
	readonly dest: string;
	constructor(src: string, dest?: string) {
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

	async cut(): Promise<void> {
		await this.copyFile();
		await this.unlink();
		return;
	}

	/**
	 * Unlink files/dirs
	 * @returns {Promise<void>}
	 */
	async unlink(): Promise<void> {
		if (await new DirectoryAPI(this.src).isDir()) {
			return await removeDir(this.src, { recursive: true });
		} else {
			return await removeFile(this.src);
		}
	}
}
export default OperationAPI;
