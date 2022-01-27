import windowName from '../../Service/window';
import Storage from '../../Service/storage';
import isValid from './validChecker';

interface OpenLogType {
	path: string;
	timestamp: Date;
}
/**
 * Write an error log
 * @param {any} err - error message
 * @returns {Promise<void>}
 */
const ErrorLog = async (err: any): Promise<void> => {
	const log = await Storage.get('log');
	let errorLog = log?.errors ?? [];
	log.errors = [...errorLog, { err, timestamp: new Date() }];
	Storage.set('log', log);
};

/**
 * Write an info log
 * @param {any} info - information
 * @returns {Promise<void>}
 */
const InfoLog = async (info: any): Promise<void> => {
	const log = await Storage.get('log');
	let infoLog = log?.info ?? [];
	log.info = [...infoLog, { info, timestamp: new Date() }];
	Storage.set('log', log);
};

/**
 * Write down operation logs
 * @param {string} operationType - type of the operation
 * @param {string|string[]} sources - files being operated
 * @param {string} destination - destination of the file operation (optional)
 * @returns {Promise<void>}
 */
const OperationLog = async (
	operationType: 'copy' | 'cut' | 'delete' | 'newfile' | 'newfolder' | 'rename',
	sources?: string | string[],
	destination?: string
): Promise<void> => {
	let operationLogs = await Storage.get(`operations-${windowName}`);
	if (!isValid(operationLogs))
		operationLogs = {
			operations: [],
			currentIndex: -1,
		};
	if (JSON.stringify(operationLogs.operations[operationLogs.currentIndex + 1]) !== JSON.stringify({ operationType, sources, destination }))
		operationLogs.operations = operationLogs.operations.slice(0, operationLogs.currentIndex + 1);
	operationLogs.currentIndex += 1;
	operationLogs.operations.push({ operationType, sources, destination });
	Storage.set(`operations-${windowName}`, operationLogs);
};

/**
 * Write down open directory log
 * @param {String} path - File/Dir path
 * @returns {Promise<void>}
 */
const OpenLog = async (path: String): Promise<void> => {
	const log = await Storage.get('log');
	let openLog = log?.opens ?? [];
	log.opens = [...openLog, { path, timestamp: new Date() }];
	Storage.set('log', log);
};

export { ErrorLog, InfoLog, OperationLog, OpenLog, OpenLogType };
