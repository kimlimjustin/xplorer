import log from 'electron-log';
import storage from 'electron-json-storage-sync';
import windowGUID from '../Constants/windowGUID';

/**
 * Write an error log
 * @param {any} err - error message
 * @returns {void}
 */
const ErrorLog = (err: any): void => {
	log.error(err);
};

/**
 * Write an info log
 * @param {any} info - information
 * @returns {void}
 */
const InfoLog = (info: any): void => {
	log.info(info);
};

/**
 * Write down operation logs
 * @param {string} operationType - type of the operation
 * @param {string|string[]} sources - files being operated
 * @param {string} destination - destination of the file operation (optional)
 * @returns {void}
 */
const OperationLog = (
	operationType:
		| 'copy'
		| 'cut'
		| 'delete'
		| 'newfile'
		| 'newfolder'
		| 'rename',
	sources?: string | string[],
	destination?: string
): void => {
	const operationLogs = storage.get(`operations-${windowGUID}`)?.data ?? {
		operations: [],
		currentIndex: -1,
	};
	if (
		JSON.stringify(
			operationLogs.operations[operationLogs.currentIndex + 1]
		) !== JSON.stringify({ operationType, sources, destination })
	)
		operationLogs.operations = operationLogs.operations.slice(
			0,
			operationLogs.currentIndex + 1
		);
	operationLogs.currentIndex += 1;
	operationLogs.operations.push({ operationType, sources, destination });
	storage.set(`operations-${windowGUID}`, operationLogs);
};

export { ErrorLog, InfoLog, OperationLog };
