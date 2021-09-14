import storage from 'electron-json-storage-sync';
import windowGUID from '../../Constants/windowGUID';
import Copy from './copy';
import Paste from './paste';
/**
 * The the _undo_ed Operation
 * @returns {any}
 */
const Redo = (): void => {
	const operationLogs = storage.get(`operations-${windowGUID}`)?.data;
	//operationLogs.currentIndex++;
	console.log(operationLogs);
	const latestOperation =
		operationLogs.operations[operationLogs.currentIndex + 1];
	switch (latestOperation.operationType) {
		case 'copy':
			Copy(latestOperation.sources);
			Paste(latestOperation.destination);
	}
};
export default Redo;
