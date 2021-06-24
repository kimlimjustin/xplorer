const path = require('path');
/**
 * Get drive's base path of a path
 * @param {string} src - path
 * @returns {string} base path result
 */
const getDriveBasePath = src => {
    return process.platform === "win32" ? escape(path.resolve(src, "/")) : escape(src)
}

module.exports = getDriveBasePath