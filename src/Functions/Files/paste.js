const clipboardy = require('clipboardy');
const path = require('path');
const fs = require('fs');
const cpy = require('cpy');
const { dialog } = require('@electron/remote')

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
            if (commandType === "COPY") {
                if (fs.lstatSync(filePath).isDirectory()) {
                    if (target === path.dirname(filePath)) {
                        cpy(filePath, path.join(target, path.basename(filePath) + ' - Copy'))
                    } else if (fs.existsSync(path.join(target, path.basename(filePath)))) {
                        const options = {
                            buttons: ["Replace", "Skip"],
                            message: `Another folder with the same name already exists in "${target}". Replacing it will overwrite its content.`,
                            title: `Replace folder ${path.basename(filePath)}`
                        }
                        if (dialog.showMessageBoxSync(options) === 0) cpy(filePath, path.join(target, path.basename(filePath)))
                    } else {
                        cpy(filePath, path.join(target, path.basename(filePath)))
                    }
                } else {
                    if (target === path.dirname(filePath)) {
                        cpy(filePath, target, {
                            rename: basename => `${basename.split(".").splice(0, basename.split(".").length - 1).join(".")} - Copy.${basename.split(".").splice(basename.split(".").length - 1)}`
                        })
                    }
                    else if (fs.existsSync(path.join(target, path.basename(filePath)))) {
                        const options = {
                            buttons: ["Replace", "Skip"],
                            message: `Another file with the same name already exists in "${target}". Replacing it will overwrite its content.`,
                            title: `Replace file ${path.basename(filePath)}`
                        }
                        if (dialog.showMessageBoxSync(options) === 0) cpy(filePath, target)
                    }
                    else cpy(filePath, target)
                }
            }
        }
    }
}

module.exports = Paste