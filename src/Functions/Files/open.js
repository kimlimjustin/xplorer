const exec = require('child_process').exec;
const path = require("path");
const openDir = require('../DOM/openDir')

const COMMAND = () => {
    switch (process.platform) {
        case 'darwin': return 'open';
        case 'win32': return 'start'
        default: return 'xdg-open';
    }
}

const openFile = file => {
    exec(`${COMMAND()} "${file}"`)
}

const listenOpen = (elements) => {
    elements.forEach(element => {
        element.addEventListener("dblclick", () => {
            // Open the file if it's not directory
            if (element.dataset.isdir !== "true") {
                openFile(element.dataset.path)
            } else {
                openDir(element.dataset.path)
            }
        })
    })
}

module.exports = { listenOpen, openFile }