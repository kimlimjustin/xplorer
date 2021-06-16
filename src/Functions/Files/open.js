const getPreview = require("../preview/preview");
const path = require('path');
const os = require('os');
const Home = require('../../Components/home');
const changePosition = require("../Tab/changePosition");
const { updateTheme } = require("../Theme/theme");
const nativeDrag = require("../DOM/drag");
const { startLoading, stopLoading } = require("../DOM/loading");
const storage = require('electron-json-storage-sync');
const Recent = require("../../Components/recent");
const LAZY_LOAD = require("../DOM/lazyLoadingImage");
const fs = require('fs');
const { ContextMenu } = require("../../Components/contextMenu");
const { isHiddenFile } = require("is-hidden-file");

const LINUX_TRASH_FILES_PATH = path.join(os.homedir(), '.local/share/Trash/files')
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info')
const IGNORE_FILE = ['.', '..'];

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
    const filePath = unescape(element.dataset.path)
    // Open the file if it's not directory
    if (element.dataset.isdir !== "true") {
        let recents = storage.get('recent')?.data;
        openFileWithDefaultApp(filePath)

        // Push file into recent files
        if (recents) {
            if (recents.indexOf(filePath) !== -1) {
                recents.push(recents.splice(recents.indexOf(filePath), 1)[0]);
                storage.set('recent', recents)
            } else {
                storage.set('recent', [...recents, filePath])
            }
        }
        else storage.set('recent', [filePath])
    } else {
        openDir(filePath)
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

const displayFiles = async (dir) => {
    const hideSystemFile = storage.get("preference")?.data?.hideSystemFiles ?? true
    const MAIN_ELEMENT = document.getElementById("main");
    MAIN_ELEMENT.innerHTML = "";
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    const files = fs.readdirSync(dir, { withFileTypes: true })
    if (!files.length) {
        MAIN_ELEMENT.classList.add('empty-dir-notification')
        MAIN_ELEMENT.innerText = "This folder is empty."
        stopLoading()
    } else {
        await files.forEach(async dirent => {
            if (IGNORE_FILE.indexOf(dirent.name) !== -1) return;
            const preview = await getPreview(path.join(dir, dirent.name), category = dirent.isDirectory() ? "folder" : "file")
            const fileGrid = document.createElement("div")
            fileGrid.className = "file-grid grid-hover-effect"
            fileGrid.setAttribute("draggable", 'true')
            fileGrid.setAttribute("data-listenOpen", '')
            fileGrid.setAttribute("data-tilt", '')
            fileGrid.dataset.isdir = dirent.isDirectory()
            if (isHiddenFile(path.join(dir, dirent.name))) fileGrid.dataset.hiddenFile = true
            fileGrid.dataset.path = escape(path.join(dir, dirent.name))
            try {
                const stat = fs.statSync(path.join(dir, dirent.name))
                fileGrid.dataset.createdAt = stat.ctime
                fileGrid.dataset.modifiedAt = stat.mtime
                fileGrid.dataset.accessedAt = stat.atime
                fileGrid.dataset.size = stat.size
            } catch (_) {
                if (hideSystemFile) return;
                else {
                    console.log(dirent.name)
                    fileGrid.dataset.systemFile = true
                    fileGrid.dataset.hiddenFile = true
                }
            }
            fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${dirent.name}</span>
            `
            MAIN_ELEMENT.appendChild(fileGrid)

            ContextMenu(fileGrid, openFileWithDefaultApp, openDir)
        })

        updateTheme()
        nativeDrag(document.querySelectorAll(".file-grid"), dir)
        listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
        LAZY_LOAD()

        console.timeEnd(dir)
        stopLoading()
    }
}

const openDir = async (dir) => {
    console.time(dir)
    startLoading()
    await changePosition(dir)
    if (dir === path.join(os.homedir(), 'Home') || dir === "Home") {
        Home(() => {
            listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
            console.timeEnd(dir)
        })
    } else if (dir === path.join(os.homedir(), 'Recent') || dir === "Recent") {
        Recent()
        changePosition('Recent')
    } else if (dir === path.join(os.homedir(), 'Trash') || dir === "Trash") {
        changePosition('Trash')
        if (process.platform === "linux") {
            const files = fs.readdirSync(LINUX_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory(), "isHidden": /(^|\/)\.[^\/\.]/g.test(dirent.name) } })
            const filesInfo = fs.readdirSync(LINUX_TRASH_INFO_PATH)
            displayFiles(files, LINUX_TRASH_FILES_PATH)
        }
    } else {
        displayFiles(dir)
    }
}

module.exports = { listenOpen, openDir, openFileWithDefaultApp }