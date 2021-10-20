import { fs } from '@tauri-apps/api';

class FileAPI {
	readonly fileName: string;
	constructor(fileName: string) {
		this.fileName = fileName;
	}
	readFile(): Promise<string> {
		return new Promise((resolve) => {
			fs.readTextFile(this.fileName).then((fileContent) =>
				resolve(fileContent)
			);
		});
	}
	async readJSONFile(): Promise<JSON> {
		const content = await this.readFile();
		return JSON.parse(content);
	}
}

export default FileAPI;
