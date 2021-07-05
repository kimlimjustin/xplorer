const clipboardy = require('clipboardy');
/**
 * Copy (a) file/s
 * 
 * Make the file path(s) as a command string and copy into clipboard and use it then while pasting file
 * 
 * @param {Array<string>} files - Array of file paths.
 * @returns {any}
 */
const Copy = (files) => {
    let commands = `Xplorer command - COPY`
    for (const file of files) {
        commands += '\n' + file
    }
    clipboardy.writeSync(commands);
    return;
}

module.exports = Copy