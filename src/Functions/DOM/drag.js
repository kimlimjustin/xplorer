const { ipcRenderer } = require('electron');
const path = require('path');

// Function to handle native drag between windows
const nativeDrag = (elements, srcPath) => {
    elements.forEach(file => {
        file.ondragstart = e => {
            e.preventDefault()
            ipcRenderer.send('ondragstart', path.join(srcPath, file.querySelector("#file-filename").innerText), {isDir: file.dataset.isdir == 'true'})
        }
    })
}

module.exports = nativeDrag