import isTauri from '../Util/is-tauri';
import DirectoryAPI from './directory';
/**
 * Invoke Rust command to operate files/dirs
 */
class OperationAPI {
	private src: string;
	private dest: string;
	constructor(src: string, dest?: string) {
		this.src = src;
		this.dest = dest;
	}
	/**
	 * Copy files/dirs
	 * @returns {Promise<void>}
	 */
	async copyFile(): Promise<void> {
		if (isTauri) {
			const { invoke } = require('@tauri-apps/api');
			return await invoke('copy', { src: this.src, dest: this.dest });
		}
	}
	/**
	 * Rename file/dir
	 * @returns {any}
	 */
	async rename(): Promise<void> {
		if (isTauri) {
			const { invoke } = require('@tauri-apps/api');

			return await invoke('rename', { path: this.src, newPath: this.dest });
		}
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
		if (isTauri) {
			const { invoke } = require('@tauri-apps/api');
			if (await new DirectoryAPI(this.src).isDir()) {
				return await invoke('remove_dir', { path: this.src });
			} else {
				return await invoke('remove_file', { path: this.src });
			}
		}
	}

	async duplicate(): Promise<void> {
		this.dest =
			this.src.split('.').length > 1 ? this.src.split('.').slice(0, -1) + ' - COPY.' + this.src.split('.').slice(-1) : this.src + ' - COPY';
		return await this.copyFile();
	}
}
export default OperationAPI;
