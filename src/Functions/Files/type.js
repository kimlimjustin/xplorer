const Types = require("../../config/type.json")
/**
 * Get type of a file name
 * @param {string} filename - File name
 * @returns {string} File Type
*/
const getType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    for (const type of Types) {
        if(type.extension.indexOf(ext) !== -1) return type.type
    }
    return `${ext.toUpperCase()} file`
}

module.exports = getType