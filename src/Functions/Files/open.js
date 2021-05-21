const { getFilesAndDir } = require("../Files/get");
const getPreview = require("../preview/preview");
const changeContent = require("../DOM/changeContent");
const path = require('path');
const os = require('os');
const Home = require('../../Components/home');
const changePosition = require("../Tab/changePosition");
const VanillaTilt = require("../../../lib/tilt/tilt");
const { updateTheme } = require("../Theme/theme");
const nativeDrag = require("../DOM/drag");
const { startLoading, stopLoading } = require("../DOM/loading");

function getCommandLine() {
    switch (process.platform) {
        case 'darwin':
            return 'open';
        default:
            return 'xdg-open';
    }
}

function openFileWithDefaultApp(file) {
    /^win/.test(process.platform) ?
        require("child_process").exec('start "" "' + file + '"') :
        require("child_process").spawn(getCommandLine(), [file],
            { detached: true, stdio: 'ignore' }).unref();
}

const openFileHandler = (e) => {
    let element = e.target
    while (!element.dataset.path) {
        element = element.parentNode
    }
    // Open the file if it's not directory
    if (element.dataset.isdir !== "true") {
        openFileWithDefaultApp(unescape(element.dataset.path))
    } else {
        openDir(unescape(element.dataset.path))
    }
}

const listenOpen = (elements) => {
    elements.forEach(element => {
        if (document.getElementById("main").contains(element)) {
            element.removeEventListener("dblclick", openFileHandler)
            element.addEventListener("dblclick", openFileHandler)
        } else {
            element.removeEventListener("click", openFileHandler)
            element.addEventListener("click", openFileHandler)
        }
    })
}

const openDir = (dir) => {
    startLoading()
    changePosition(dir)
    if (dir === path.join(os.homedir(), 'Home') || dir === "Home") {
        Home(() => {
            listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
        })
    } else {
        getFilesAndDir(dir, async files => {
            const result = document.createElement("div");
            if (!files.length) {
                let emptyDirNotification = document.createElement("span")
                emptyDirNotification.classList.add('empty-dir-notification')
                emptyDirNotification.innerText = "This folder is empty."
                changeContent(emptyDirNotification);
            } else {
                for (const file of files) {
                    const preview = await getPreview(path.join(dir, file.filename), category = file.isDir ? "folder" : "file")
                    result.innerHTML += `<div class="file-grid grid-hover-effect" draggable="true" data-isdir=${file.isDir} data-path = ${escape(path.join(dir, file.filename))} data-listenOpen data-tilt>
                    ${preview}
                    <span class="file-grid-filename" id="file-filename">${file.filename}</span>
                    </div>`
                }
                changeContent(result, autoScroll = false)
                updateTheme()
                nativeDrag(document.querySelectorAll(".file-grid"), dir)
                listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
                stopLoading()
            }
        })
    }
}

module.exports = { listenOpen, openDir }