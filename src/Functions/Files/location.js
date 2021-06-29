const clipboardy = require("clipboardy");
/**
 * Copy file location from file element into clipborad
 * @param {any} element - file element
 * @returns {any}
 */
const copyLocation = (element) => {
    const path = unescape(element.dataset.path)
    clipboardy.writeSync(path);
}

module.exports = copyLocation