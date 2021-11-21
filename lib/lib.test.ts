import FileLib from './files.json';
import FolderLib from './folder.json';
import fs from 'fs';
import path from 'path';
describe('lib', () => {
	it('lib files', () => {
		for (const category of FileLib) {
			if (category.thumbnail) {
				const exists = fs.existsSync(path.join(__dirname, '../src/Icon/', category.thumbnail));
				if (!exists) {
					console.error(`${category.thumbnail} does not exists`);
				}
				expect(exists).toBeTruthy();
			}
		}
	});
	it('lib folder', () => {
		for (const category of FolderLib) {
			if (category.thumbnail) {
				const exists = fs.existsSync(path.join(__dirname, '../src/Icon/', category.thumbnail));
				if (!exists) {
					console.error(`${category.thumbnail} does not exist`);
				}
				expect(exists).toBeTruthy();
			}
		}
	});
});
