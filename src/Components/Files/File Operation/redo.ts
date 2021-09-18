import storage from 'electron-json-storage-sync';
import windowGUID from '../../Constants/windowGUID';
import Copy from './copy';
import Paste from './paste';
import fs from 'fs';
import mv from 'mv';
import { dialog } from '@electron/remote';
import { ErrorLog } from '../../Functions/log';
import path from 'path';
import { Trash } from './trash';
/**
 * The the _undo_ed Operation
 * @returns {any}
 */
const Redo = (): void => {
	const operationLogs = storage.get(`operations-${windowGUID}`)?.data;
	const latestOperation =
		operationLogs.operations[operationLogs.currentIndex + 1];
	switch (latestOperation.operationType) {
		case 'copy':
			Copy(latestOperation.sources);
			Paste(latestOperation.destination);
			break;
		case 'cut':
			for (const source of latestOperation.sources) {
				mv(
					source,
					path.join(
						latestOperation.destination,
						path.basename(source)
					),
					(err) => {
						if (err) {
							dialog.showMessageBoxSync({
								message:
									'Something went wrong, please try again or open an issue on GitHub.',
								type: 'error',
							});
							ErrorLog(err);
						}
					}
				);
			}
			operationLogs.currentIndex++;
			break;
		case 'newfile':
			fs.writeFileSync(latestOperation.destination, '');
			operationLogs.currentIndex++;
			break;
		case 'newfolder':
			fs.mkdirSync(latestOperation.destination);
			operationLogs.currentIndex++;
			break;
		case 'delete':
			Trash(latestOperation.sources);
			operationLogs.currentIndex++;
			break;
	}
	storage.set(`operations-${windowGUID}`, operationLogs);
};
export default Redo;
