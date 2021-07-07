const log = require("electron-log");

/**
 * Write an error log
 * @param {any} err - error message
 * @returns {any}
 */
const ErrorLog = (err) => {
    log.error(err)
}

/**
 * Write an info log
 * @param {any} info - information
 * @returns {any}
 */
const InfoLog = (info) => {
    log.info(info)
}


module.exports = { ErrorLog, InfoLog }