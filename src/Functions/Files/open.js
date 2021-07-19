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
const formatBytes = require("../Math/filesize");
const getType = require("./type");
const { SelectListener } = require("./select");
const { InfoLog } = require("../Logs/log");

const WINDOWS_TRASH_FILES_PATH = "C:\\Trash/files";
const WINDOWS_TRASH_INFO_PATH = "C:\\Trash/info";
const LINUX_TRASH_FILES_PATH = path.join(os.homedir(), '.local/share/Trash/files')
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info')
const IGNORE_FILE = ['.', '..'];

let timeStarted;

/**
 * Get command to open a file with default app on various operating systems.
 * @returns {any}
 */
function getCommandLine() {
    switch (process.platform) {
        case 'darwin':
            return 'open';
        default:
            return 'xdg-open';
    }
}

/**
 * Open a file with default app registered
 * @param {string} file path
 * @returns {any}
 */
function openFileWithDefaultApp(file) {
    /^win/.test(process.platform) ?
        require("child_process").exec('start "" "' + file + '"') :
        require("child_process").spawn(getCommandLine(), [file],
            { detached: true, stdio: 'ignore' }).unref();
}

/**
 * Open file handler
 * @param {any} e - event
 * @returns {any}
 */
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

/**
 * Listen elements and pass it into the handler
 * @param {Array} elements - array of elements to be listened
 * @returns {any}
 */
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

/**
 * Display files into Xplorer main section
 * @param {Array} files - array of files of a directory
 * @param {string} dir - directory base path
 * @returns {any}
 */
const displayFiles = async (files, dir) => {
    const hideSystemFile = storage.get("preference")?.data?.hideSystemFiles ?? true
    const dirAlongsideFiles = storage.get("preference")?.data?.dirAlongsideFiles ?? false
    const layout = storage.get("layout")?.data?.[dir] ?? storage.get("preference")?.data?.layout ?? "s"
    const sort = storage.get("sort")?.data?.[dir] ?? 'A'
    const MAIN_ELEMENT = document.getElementById("main");
    MAIN_ELEMENT.innerHTML = "";
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    files = files.sort((a, b) => {
        switch (sort) {
            case "A": // A-Z
                return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
            case "Z": // Z-A
                return a.name.toLowerCase() < b.name.toLowerCase() ? 1 : -1
            case "L": // Last Modified
                return new Date(a.modifiedAt) < new Date(b.modifiedAt) ? 1 : -1
            case "F": // First Modified
                return new Date(a.modifiedAt) > new Date(b.modifiedAt) ? 1 : -1
            case "S": // Size
                return a.size > b.size ? 1 : -1
            case "T":
                return a.type > b.type ? 1 : -1
        }
    })
    if (!dirAlongsideFiles) {
        files = files.sort((a, b) => -(a.isDir - b.isDir))
    }
    if (!files.length) {
        MAIN_ELEMENT.classList.add('empty-dir-notification')
        MAIN_ELEMENT.innerText = "This folder is empty."
        stopLoading()
    } else {
        await files.forEach(async dirent => {
            if (hideSystemFile && dirent.isSystemFile) return;
            if (IGNORE_FILE.indexOf(dirent.name) !== -1) return;
            const preview = await getPreview(path.join(dir, dirent.name), category = dirent.isDir ? "folder" : "file")
            const fileGrid = document.createElement("div")
            fileGrid.className = "file-grid grid-hover-effect file"
            if (dirent.isTrash) fileGrid.dataset.isTrash = true
            switch (layout) {
                case "m":
                    fileGrid.classList.add("medium-grid-view")
                    break;
                case "l":
                    fileGrid.classList.add("large-grid-view")
                    break;
                case "d":
                    fileGrid.classList.add("detail-view")
                    break;
                default:
                    fileGrid.classList.add("small-grid-view")
                    break;

            }
            fileGrid.setAttribute("draggable", 'true')
            fileGrid.setAttribute("data-listenOpen", '')
            fileGrid.setAttribute("data-tilt", '')
            fileGrid.dataset.isdir = dirent.isDir
            if (dirent.isHidden) fileGrid.dataset.hiddenFile = true
            fileGrid.dataset.path = escape(dirent.path ?? path.join(dir, dirent.name))
            fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${dirent.name}</span><span class="file-modifiedAt" id="file-createdAt">${new Date(dirent.modifiedAt ?? dirent.trashDeletionDate).toLocaleString(navigator.language, { hour12: false })}</span>
            ${dirent.size > 0 ? `<span class="file-size" id="file-size">${formatBytes(dirent.size)}</span>` : `<span class="file-size" id="file-size"></span>`}
            <span class="file-type">${dirent.type}</span>
            `
            MAIN_ELEMENT.appendChild(fileGrid)

            ContextMenu(fileGrid, openFileWithDefaultApp, openDir)
        })

        updateTheme()
        nativeDrag(document.querySelectorAll(".file"), dir)
        SelectListener(document.querySelectorAll(".file"))
        listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
        LAZY_LOAD()

        InfoLog(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
        stopLoading()
        console.log(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
    }
}

/**
 * Open a directory on Xplorer
 * @param {string} dir
 * @returns {any}
 */
const openDir = async (dir) => {
    timeStarted = Date.now()
    startLoading()
    await changePosition(dir)
    if (dir === path.join(os.homedir(), 'Home') || dir === "Home" || dir === "xplorer://Home") {
        Home(() => {
            listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
            SelectListener(document.querySelectorAll(".file"))
            InfoLog(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
            console.log(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
        })
    } else if (dir === path.join(os.homedir(), 'Recent') || dir === "Recent" || dir === "xplorer://Recent") {
        Recent()
    } else if (dir === path.join(os.homedir(), 'Trash') || dir === "Trash" || dir === "xplorer://Trash") {
        const getFiles = () => {
            if (process.platform === "win32") {
                if(!fs.existsSync(WINDOWS_TRASH_FILES_PATH)) return []
                else {
                    return fs.readdirSync(WINDOWS_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => {
                        let fileInfo = fs.readFileSync(path.join(WINDOWS_TRASH_INFO_PATH, dirent.name + '.trashinfo'), 'utf8').split("\n")
                        let trashPath, trashDeletionDate;
                        if (fileInfo[0] === "[Trash Info]") {
                            trashPath = fileInfo[1].split('=')[1]
                            trashDeletionDate = fileInfo[2].split("=")[1]
                        }
                        const type = dirent.isDirectory() ? "File Folder" : getType(unescape(trashPath) ?? path.join(dir, dirent.name))
                        return { name: unescape(trashPath), isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)), trashPath, trashDeletionDate, type, isTrash: true, path: unescape(trashPath) };
                    })
                }
            }else{
                return fs.readdirSync(LINUX_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => {
                    let fileInfo = fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, dirent.name + '.trashinfo'), 'utf8').split("\n")
                    let trashPath, trashDeletionDate;
                    if (fileInfo[0] === "[Trash Info]") {
                        trashPath = fileInfo[1].split('=')[1]
                        trashDeletionDate = fileInfo[2].split("=")[1]
                    }
                    const type = dirent.isDirectory() ? "File Folder" : getType(unescape(trashPath) ?? path.join(dir, dirent.name))
                    return { name: unescape(trashPath), isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)), trashPath, trashDeletionDate, type, isTrash: true, path: unescape(trashPath) };
                })
            }
        }
        let files = getFiles()
        displayFiles(files, process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH)
        // Watch the directory
        const watcher = fs.watch(process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH, async (eventType, filename) => {
            let files = getFiles()
            // Get files of the dir
            displayFiles(files, process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH)
        })
        let focusingPath; // Watch if focusing path changes
        setInterval(() => {
            const tabs = storage.get('tabs')?.data
            const _focusingPath = tabs.tabs[tabs.focus]?.position
            if (focusingPath === undefined) {
                focusingPath = _focusingPath
            } else {
                if (focusingPath !== _focusingPath) {
                    watcher.close()
                }
            }
        }, 500);
        
    } else {
        const hideSystemFile = storage.get("preference")?.data?.hideSystemFiles ?? true
        let getAttributesSync;
        if (process.platform === "win32") getAttributesSync = require("fswin").getAttributesSync;
        const getFiles = () => {
            return fs.readdirSync(dir, { withFileTypes: true }).map(dirent => {
                let result = { name: dirent.name, isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)) }
                const type = dirent.isDirectory() ? "File Folder" : getType(path.join(dir, dirent.name))
                result.type = type
                try {
                    const stat = fs.statSync(path.join(dir, dirent.name))
                    result.createdAt = stat.ctime
                    result.modifiedAt = stat.mtime
                    result.accessedAt = stat.atime
                    result.size = stat.size
                } catch (_) {
                    if (process.platform === "win32" && !hideSystemFile) {
                        const stat = getAttributesSync(path.join(dir, dirent.name));
                        if (stat) {
                            result.createdAt = stat.CREATION_TIME;
                            result.modifiedAt = stat.LAST_WRITE_TIME;
                            result.accessedAt = stat.LAST_ACCESS_TIME;
                            result.size = stat.SIZE;
                        }
                    }
                    result.isSystemFile = true
                }
                return result
            })
        }
        let files = getFiles()
        displayFiles(files, dir)
        // Watch the directory
        const watcher = fs.watch(dir, async (eventType, filename) => {
            let files = getFiles()
            // Get files of the dir
            displayFiles(files, dir)
        })

        let focusingPath; // Watch if focusing path changes
        setInterval(() => {
            const tabs = storage.get('tabs')?.data
            const _focusingPath = tabs.tabs[tabs.focus]?.position
            if (focusingPath === undefined) {
                focusingPath = _focusingPath
            } else {
                if (focusingPath !== _focusingPath) {
                    watcher.close()
                }
            }
        }, 500);
    }
}

module.exports = { listenOpen, openDir, openFileWithDefaultApp }