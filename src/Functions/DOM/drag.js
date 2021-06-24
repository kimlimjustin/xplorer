const { ipcRenderer } = require('electron');
const path = require('path');

/**
 * Handle native drag between windows
 * @param {any} elements - elements to be listened to
 * @param {any} srcPath - base path of the element
 * @returns {any}
 */
const nativeDrag = (elements, srcPath) => {
    elements.forEach(file => {
        file.ondragstart = e => {
            e.preventDefault()
            ipcRenderer.send('ondragstart', path.join(srcPath, file.querySelector("#file-filename").innerText), { isDir: file.dataset.isdir == 'true' })
        }
    })
}

module.exports = nativeDrag