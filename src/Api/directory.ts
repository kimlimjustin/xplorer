import { invoke, path } from '@tauri-apps/api';

interface readDirReturnType {
	array_of_files: string[];
}

interface FileWithName {
	path: string;
	name: string;
}
class DirectoryAPI {
	readonly dirName: string;
	constructor(dirName: string) {
		this.dirName = dirName;
	}
	getFiles(): Promise<string[]> {
		return new Promise((resolve) => {
			invoke('read_directory', { dir: this.dirName }).then(
				(files: readDirReturnType) => resolve(files.array_of_files)
			);
		});
	}
	async getFilesWithName(): Promise<FileWithName[]> {
		const result = [];
		const files = await this.getFiles();
		for (const file of files) {
			result.push({ path: file, name: await path.basename(file) });
		}
		return result;
	}
	async isDir(): Promise<boolean> {
		return new Promise((resolve) => {
			invoke('is_dir', { path: this.dirName }).then((result: boolean) =>
				resolve(result)
			);
		});
	}
}

export default DirectoryAPI;
