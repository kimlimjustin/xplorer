const { getFilesAndDir } = require("../Files/get");
const getPreview = require("../preview/preview");
const changeContent = require("../DOM/changeContent");
const path = require('path');
const os = require('os');
const open = require('open');
const Home = require('../../Components/home.js');

const listenOpen = (elements) => {
    elements.forEach(element => {
        element.addEventListener("dblclick", () => {
            // Open the file if it's not directory
            if (element.dataset.isdir !== "true") {
                open(element.dataset.path)
            } else {
                openDir(element.dataset.path)
            }
        })
    })
}

const openDir = (dir) => {
    if(dir === path.join(os.homedir(), 'Home')){
        Home()
    }
    getFilesAndDir(dir, async files => {
        const result = document.createElement("div");
        for (const file of files) {
            const preview = await getPreview(path.join(dir, file.filename), category = file.isDir ? "folder" : "file")
            result.innerHTML += `<div class="file-grid" draggable="true" data-isdir=${file.isDir} data-path = ${path.join(dir, file.filename)} data-listenOpen>
            ${preview}
            <span class="file-grid-filename" id="file-filename">${file.filename}</span>
            </div>`
        }
        changeContent(result)
        listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
    })
}

module.exports = { listenOpen, openDir }