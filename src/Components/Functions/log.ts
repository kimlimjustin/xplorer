import log from 'electron-log';

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

export { ErrorLog, InfoLog };
