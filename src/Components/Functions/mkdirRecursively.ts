import path from 'path';
import fs from 'fs/promises';

/**
 * Create dir path recursively
 * @param {string} dir - folder path that should be created
 */
export const mkdirRecursively = async (dir: string): Promise<void> => {
	const splitFileName = dir.split('/');

	for (let i = 1; i < splitFileName.length; i++) {
		const parentPath = path.join(splitFileName.splice(0, i).join('/'));
		const parentPathExists = await fs.stat(parentPath);

		if (!parentPathExists) {
			await fs.mkdir(parentPath);
		}
	}
}
