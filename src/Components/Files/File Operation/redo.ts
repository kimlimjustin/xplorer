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
	const increaseIndex = () => {
		if (operationLogs.currentIndex + 1 > operationLogs.operations.length)
			operationLogs.currentIndex++;
	};
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
			increaseIndex();
			break;
		case 'newfile':
			fs.writeFileSync(latestOperation.destination, '');
			increaseIndex();
			break;
		case 'newfolder':
			fs.mkdirSync(latestOperation.destination);
			increaseIndex();
			break;
		case 'delete':
			Trash(latestOperation.sources);
			increaseIndex();
			break;
		case 'rename':
			fs.rename(
				latestOperation.sources,
				latestOperation.destination,
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
			increaseIndex();
			break;
	}
	storage.set(`operations-${windowGUID}`, operationLogs);
};
export default Redo;
