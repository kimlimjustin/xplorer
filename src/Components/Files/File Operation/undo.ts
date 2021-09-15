import storage from 'electron-json-storage-sync';
import windowGUID from '../../Constants/windowGUID';
import path from 'path';
import fs from 'fs';

/**
 * Undo the latest operation
 * @returns {any}
 */
const Undo = (): void => {
	const operationLogs = storage.get(`operations-${windowGUID}`)?.data;
	const latestOperation =
		operationLogs.operations[operationLogs.currentIndex];
	switch (latestOperation.operationType) {
		case 'copy':
			for (const source of latestOperation.sources) {
				const filename = path.join(
					latestOperation.destination,
					path.basename(source)
				);
				const filenameWithCopySuffix = `${filename
					.split('.')
					.splice(0, filename.split('.').length - 1)
					.join('.')} - Copy.${filename
					.split('.')
					.splice(filename.split('.').length - 1)}`;
				const copiedFile = fs.existsSync(filenameWithCopySuffix)
					? filenameWithCopySuffix
					: filename;
				fs.unlinkSync(copiedFile);
			}
			break;
		case 'newfile':
			fs.unlinkSync(latestOperation.destination);
			break;
		case 'newfolder':
			fs.rmdirSync(latestOperation.destination);
			break;
	}
	operationLogs.currentIndex -= 1;
	storage.set(`operations-${windowGUID}`, operationLogs);
};

export default Undo;
