import windowGUID from '../Constants/windowGUID';
import Storage from '../../Api/storage';

interface OpenLogType {
	path: string;
	date: string;
}
/**
 * Write an error log
 * @param {any} err - error message
 * @returns {Promise<void>}
 */
const ErrorLog = async (err: any): Promise<void> => {
	const log = (await Storage.get('log'))?.errors ?? [];

	Storage.set('log', { errors: [...log, err] });
};

/**
 * Write an info log
 * @param {any} info - information
 * @returns {Promise<void>}
 */
const InfoLog = async (info: any): Promise<void> => {
	const log = (await Storage.get('log'))?.info ?? [];

	Storage.set('log', { info: [...log, info] });
};

/**
 * Write down operation logs
 * @param {string} operationType - type of the operation
 * @param {string|string[]} sources - files being operated
 * @param {string} destination - destination of the file operation (optional)
 * @returns {Promise<void>}
 */
const OperationLog = async (
	operationType:
		| 'copy'
		| 'cut'
		| 'delete'
		| 'newfile'
		| 'newfolder'
		| 'rename',
	sources?: string | string[],
	destination?: string
): Promise<void> => {
	const operationLogs = (await Storage.get(`operations-${windowGUID}`)) ?? {
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
	Storage.set(`operations-${windowGUID}`, operationLogs);
};

/**
 * Write down open directory log
 * @param {String} path - File/Dir path
 * @returns {Promise<void>}
 */
const OpenLog = async (path: String): Promise<void> => {
	const log = (await Storage.get('log'))?.opens ?? [];
	Storage.set('log', {
		opens: [...log, { path, date: new Date() }],
	});
};

export { ErrorLog, InfoLog, OperationLog, OpenLog, OpenLogType };
