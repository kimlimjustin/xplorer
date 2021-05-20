const { getFilesAndDir } = require("../Files/get");
const getPreview = require("../preview/preview");
const changeContent = require("../DOM/changeContent");
const path = require('path');
const os = require('os');
const open = require('open');
const Home = require('../../Components/home');
const changePosition = require("../Tab/changePosition");

const openFileHandler = (e) => {
    const element = e.target.dataset.path ? e.target : e.target.parentNode.dataset.path ? e.target.parentNode : e.target.parentNode.parentNode
    console.log(element)
    // Open the file if it's not directory
    if (element.dataset.isdir !== "true") {
        open(unescape(element.dataset.path))
    } else {
        openDir(unescape(element.dataset.path))
    }
}

const listenOpen = (elements) => {
    //console.log(elements)
    elements.forEach(element => {
        element.removeEventListener("dblclick", openFileHandler)
        element.addEventListener("dblclick", openFileHandler)
    })
}

const openDir = (dir) => {
    changePosition(dir)
    if(dir === path.join(os.homedir(), 'Home') || dir === "Home"){
        Home(() => {
            listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
        })
    }else{
        getFilesAndDir(dir, async files => {
            const result = document.createElement("div");
            if(!files.length){
                let emptyDirNotification = document.createElement("span")
                emptyDirNotification.classList.add('empty-dir-notification')
                emptyDirNotification.innerText = "This folder is empty."
                changeContent(emptyDirNotification);
            }else{
                for (const file of files) {
                    const preview = await getPreview(path.join(dir, file.filename), category = file.isDir ? "folder" : "file")
                    result.innerHTML += `<div class="file-grid" draggable="true" data-isdir=${file.isDir} data-path = ${escape(path.join(dir, file.filename))} data-listenOpen>
                    ${preview}
                    <span class="file-grid-filename" id="file-filename">${file.filename}</span>
                    </div>`
                }
                changeContent(result, autoScroll = false)
                listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
            }
        })
    }
}

module.exports = { listenOpen, openDir }