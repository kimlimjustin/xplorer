const prompt = require('electron-prompt');
const path = require('path');
const fs = require("fs");
/**
 * Rename file/folder name
 * @param {any} path - location of the file/folder
 * @returns {any}
 */
const Rename = (filePath) => {
    prompt({ title: 'New File Name', label: 'New Name:', inputAttrs: { type: 'text', required: true }, type: 'input', value: path.basename(filePath) })
        .then(newName => {
            fs.rename(filePath, path.join(path.dirname(filePath), newName), err => {
                if (err) dialog.showMessageBoxSync({ message: "Something went wrong, please try again or open an issue on GitHub.", type: "error" })
            })
        })
    console.log(path)
}

module.exports = Rename