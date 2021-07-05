const clipboardy = require('clipboardy');
const fs = require('fs');
const path = require('path');
/**
 * Paste copied files into a folder
 * @param {any} target - Folder you want to paste copied files into
 * @returns {any}
 */
const Paste = (target) => {
    const clipboard = clipboardy.readSync()
    // CHeck if the copied text is Xplorer command
    if (!clipboard.startsWith("Xplorer command")) {
        return;
    } else {
        const commandType = clipboard.split("\n")[0].replace("Xplorer command - ", '')
        const filePaths = []
        for (let i = 1; i < clipboard.split("\n").length; i++) {
            filePaths.push(clipboard.split("\n")[i])
        }
        for (const filePath of filePaths) {
            fs.copyFile(filePath, path.join(target, path.basename(filePath)), (err) => {
                if (err) console.log(err)
            })
        }
    }
}

module.exports = Paste