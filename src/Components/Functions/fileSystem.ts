import fs from 'fs/promises';
import path from 'path';

const pathPrefix = process.platform === 'win32' ? '' : '/'

/**
 * Checks that path exists
 * @param {string} path
 */
export const exists = async (path: string): Promise<boolean> => {
	try {
		await fs.stat(path);

		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Creates file
 * @param {string} path
 */
export const createFile = async (path: string): Promise<void> => fs.writeFile(path, '')


/**
 * Create dir path recursively
 * @param {string} dir - folder path that should be created
 */
export const mkdirRecursively = async (dir: string): Promise<void> => {
	const splitFileName = dir.split('/');
	let pathToDirectory = pathPrefix

	for (let i = 0; i < splitFileName.length; i++) {
		pathToDirectory = path.join(pathToDirectory, splitFileName[i]);
		const parentPathExists = await exists(pathToDirectory);

		if (!parentPathExists) {
			await fs.mkdir(path.normalize(pathToDirectory));
		}
	}
}
