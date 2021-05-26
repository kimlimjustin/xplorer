const { getFilesAndDir } = require("../Files/get");
const getPreview = require("../preview/preview");
const path = require('path');
const os = require('os');
const Home = require('../../Components/home');
const changePosition = require("../Tab/changePosition");
const { updateTheme } = require("../Theme/theme");
const nativeDrag = require("../DOM/drag");
const { startLoading, stopLoading } = require("../DOM/loading");
const storage = require('electron-json-storage-sync')

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

const FETCHED_ICONS = [] // Array of fetch icons

const isElementInViewport = el => { // Check if element in viewport
    var rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}


const openDir = (dir) => {
    console.time(dir)
    const MAIN_ELEMENT = document.getElementById("main");
    startLoading()
    changePosition(dir)
    if (dir === path.join(os.homedir(), 'Home') || dir === "Home") {
        Home(() => {
            listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
            console.timeEnd(dir)
        })
    } else {
        getFilesAndDir(dir, async files => {
            MAIN_ELEMENT.innerHTML = "";
            if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
            if (!files.length) {
                MAIN_ELEMENT.classList.add('empty-dir-notification')
                MAIN_ELEMENT.innerText = "This folder is empty."
                stopLoading()
            } else {
                for (const file of files) {
                    const preview = await getPreview(path.join(dir, file.filename), category = file.isDir ? "folder" : "file")
                    const fileGrid = document.createElement("div")
                    fileGrid.className = "file-grid grid-hover-effect"
                    fileGrid.setAttribute("draggable", 'true')
                    fileGrid.setAttribute("data-listenOpen", '')
                    fileGrid.setAttribute("data-tilt", '')
                    fileGrid.dataset.isdir = file.isDir
                    if (file.isHidden) fileGrid.dataset.hiddenFile = true
                    fileGrid.dataset.path = escape(path.join(dir, file.filename))
                    fileGrid.innerHTML = `
                    ${preview}
                    <span class="file-grid-filename" id="file-filename">${file.filename}</span>
                    `
                    MAIN_ELEMENT.appendChild(fileGrid)
                }

                updateTheme()
                nativeDrag(document.querySelectorAll(".file-grid"), dir)
                listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file

                // Only show image when its visible in viewport to reduce latency
                MAIN_ELEMENT.querySelectorAll("img").forEach(img => {
                    if (img.dataset.src) {
                        let _detectImg = setInterval(() => {
                            if (isElementInViewport(img)) {
                                img.src = img.dataset.src
                                if (FETCHED_ICONS.indexOf(img.dataset.src) === -1) FETCHED_ICONS.push(img.dataset.src)
                                img.removeAttribute("data-src")
                                clearInterval(_detectImg)
                            } else {
                                // Directly show icons if it was fetched before
                                if (FETCHED_ICONS.indexOf(img.dataset.src) !== - 1) {
                                    img.src = img.dataset.src
                                    clearInterval(_detectImg)
                                }
                            }
                        }, 500);
                    }
                })
                console.timeEnd(dir)
                stopLoading()
            }
        })
    }
}

module.exports = { listenOpen, openDir }