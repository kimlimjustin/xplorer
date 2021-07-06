const clipboardy = require('clipboardy');
/**
 * Cut (a) file/s
 * 
 * Make the file path(s) as a command string and copy into clipboard and use it then while pasting file
 * 
 * @param {Array<string>} files - Array of file paths.
 * @returns {any}
 */
const Cut = (files) => {
    let commands = `Xplorer command - CUT`
    for (const file of files) {
        commands += '\n' + file
    }
    clipboardy.writeSync(commands);
    return;
}

module.exports = Cut