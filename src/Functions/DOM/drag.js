const { ipcRenderer } = require('electron');
const path = require('path');
const nativeDrag = (elements, srcPath) => {
    elements.forEach(file => {
        file.ondragstart = e => {
            e.preventDefault()
            ipcRenderer.send('ondragstart', path.join(srcPath, file.innerText))
        }
    })
}

module.exports = nativeDrag