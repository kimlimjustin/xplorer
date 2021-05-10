const exec = require('child_process').exec;
const path = require("path");

const COMMAND = () => {
    switch(process.platform){
        case 'darwin': return 'open';
        case 'win32': return 'start'
        default: return 'xdg-open';
    }
}

const openFile = file => {
    exec(`${COMMAND()} ${file}`)
}

const listenOpen = (elements, dirPath) => {
    elements.forEach(element => {
        element.addEventListener("dblclick", () => {
            openFile(path.join(dirPath, element.querySelector("#file-filename").innerText))
        })
    })
}

module.exports = {listenOpen, openFile}