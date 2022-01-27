import Copy from './copy';
import Paste from './paste';
import windowName from '../../../Service/window';
import Storage from '../../../Service/storage';
import NewFile from './new';
import getBasename from '../../Functions/path/basename';
import getDirname from '../../Functions/path/dirname';
import NewFolder from '../../Folder/new';
import DirectoryAPI from '../../../Service/directory';
import ConfirmDialog from '../../Prompt/confirm';
import OperationAPI from '../../../Service/operation';
import joinPath from '../../Functions/path/joinPath';
import { Trash } from './trash';
/**
 * Redo the _undo_ed Operation
 * @returns {Promise<void>}
 */
const Redo = async (): Promise<void> => {
	const operationLogs = await Storage.get(`operations-${windowName}`);
	const latestOperation = operationLogs.operations[operationLogs.currentIndex + 1];
	const increaseIndex = () => {
		if (operationLogs.currentIndex + 2 >= operationLogs.operations.length) operationLogs.currentIndex = operationLogs.currentIndex + 1;
	};
	switch (latestOperation.operationType) {
		case 'copy':
			Copy(latestOperation.sources);
			Paste(latestOperation.destination);
			break;
		case 'cut':
			for (const source of latestOperation.sources) {
				const dest = joinPath(latestOperation.destination, getBasename(source));
				if (await new DirectoryAPI(dest).exists()) {
					if (
						!(await ConfirmDialog(
							'Target file exists',
							'Target directory with the same file/dir name exists, do you want to overwrite it?',
							'No'
						))
					)
						return;
					else {
						await new OperationAPI(dest).unlink();
					}
				}
				await new OperationAPI(source, dest).rename();
			}
			increaseIndex();
			break;
		case 'newfile':
			NewFile(getBasename(latestOperation.destination), getDirname(latestOperation.destination), false);
			increaseIndex();
			break;
		case 'newfolder':
			NewFolder(getBasename(latestOperation.destination), getDirname(latestOperation.destination), false);
			increaseIndex();
			break;
		case 'delete':
			Trash(latestOperation.sources);
			increaseIndex();
			break;
		case 'rename':
			await new OperationAPI(latestOperation.sources, latestOperation.destination).rename();
			increaseIndex();
			break;
	}
	Storage.set(`operations-${windowName}`, operationLogs);
};
export default Redo;
