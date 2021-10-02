import fileIcon from "../File Icon/fileIcon";
import path from "path";
import os from "os";
import Home from '../../Layout/home';
import changePosition from "../../Functions/changePosition";
import { updateTheme } from "../../Theme/theme";
import nativeDrag from "./drag";
import { startLoading, stopLoading } from "../../Functions/Loading/loading";
import storage from "electron-json-storage-sync";
import Recent from "../../Recent/recent";
import LAZY_LOAD from "../../Functions/lazyLoadingImage";
import fs from "fs";
import {isHiddenFile} from "is-hidden-file";
import { ContextMenu } from "../../ContextMenu/contextMenu";
import formatBytes from "../../Functions/filesize";
import getType from "../File Type/type";
import { SelectListener, Select } from "./select";
import { InfoLog, ErrorLog } from "../../Functions/log";
import { closePreviewFile } from "../File Preview/preview";
import {dialog} from "@electron/remote";
import type fileData from "../../../Typings/fileData";
import { ipcRenderer } from "electron";
import { FSWatcher } from "original-fs";

const WINDOWS_TRASH_FILES_PATH = "C:\\Trash/files";
const WINDOWS_TRASH_INFO_PATH = "C:\\Trash/info";
const LINUX_TRASH_FILES_PATH = path.join(os.homedir(), '.local/share/Trash/files')
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info')
const IGNORE_FILE = ['.', '..'];

let timeStarted:number;
let watcher:undefined|FSWatcher;


/**
 * Close dir watcher
 * @returns {void}
 */
const closeWatcher = ():void => {
    watcher?.close()
}

/**
 * Get command to open a file with default app on various operating systems.
 * @returns {string}
 */
const getCommandLine =():string => {
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
 * @returns {void}
 */
function openFileWithDefaultApp(file:string) :void{
    const child_process = require("child_process"); //eslint-disable-line
    /^win/.test(process.platform) ?
        child_process.exec('start "" "' + file + '"') :
        child_process.spawn(getCommandLine(), [file],
            { detached: true, stdio: 'ignore' }).unref();
}

/**
 * Open file handler
 * @param {any} e - event
 * @returns {void}
 */
const openFileHandler = (e:Event):void => {
    let element = e.target as HTMLElement;
    while (!element.dataset.path) {
        element = element.parentNode as HTMLElement
    }
    const filePath = unescape(element.dataset.path)
    // Open the file if it's not directory
    if (element.dataset.isdir !== "true") {
        const recents = storage.get('recent')?.data;
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
        open(filePath)
    }
}

/**
 * Listen elements and pass it into the handler
 * @param {NodeListOf<HTMLElement>} elements - array of elements to be listened
 * @returns {void}
 */
const listenOpen = (elements: NodeListOf<HTMLElement>):void => {
    elements.forEach(element => {
        if (document.getElementById("workspace").contains(element)) {
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
 * @param {fileData[]} files - array of files of a directory
 * @param {string} dir - directory base path
 * @returns {void}
 */
const displayFiles = async (files: fileData[], dir:string, options?: {reveal: boolean, initialDirToOpen: string}) => {
    const hideSystemFile = storage.get("preference")?.data?.hideSystemFiles ?? true
    const dirAlongsideFiles = storage.get("preference")?.data?.dirAlongsideFiles ?? false
    const layout = storage.get("layout")?.data?.[dir] ?? storage.get("preference")?.data?.layout ?? "s"
    const sort = storage.get("sort")?.data?.[dir] ?? 'A'
    const MAIN_ELEMENT = document.getElementById("workspace");
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
        files = files.sort((a, b) => -(Number(a.isDir) - Number(b.isDir)))
    }
    if (!files.length) {
        MAIN_ELEMENT.classList.add('empty-dir-notification')
        MAIN_ELEMENT.innerText = "This folder is empty."
        stopLoading()
    } else {
        await files.forEach(async dirent => {
            if (hideSystemFile && dirent.isSystemFile) return;
            if (IGNORE_FILE.indexOf(dirent.name) !== -1) return;
            const preview = await fileIcon(dirent.type === "Image" && dirent.isTrash ? dirent.realPath : path.join(dir, dirent.name), dirent.isDir ? "folder" : "file")
            const fileGrid = document.createElement("div")
            fileGrid.className = "file-grid grid-hover-effect file"
            if (dirent.isTrash) fileGrid.dataset.isTrash = "true"
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
            fileGrid.dataset.modifiedAt = String(dirent.modifiedAt);
            fileGrid.dataset.createdAt = String(dirent.createdAt);
            fileGrid.dataset.accessedAt = String(dirent.accessedAt);
            fileGrid.dataset.isdir = String(dirent.isDir)
            if(dirent.trashDeletionDate) fileGrid.dataset.trashDeletionDate = String(dirent.trashDeletionDate);
            if (dirent.isHidden) fileGrid.dataset.hiddenFile = "true"
            if (dirent.realPath) fileGrid.dataset.realPath = escape(dirent.realPath ?? path.join(dir, dirent.name))
            fileGrid.dataset.path = escape(dirent.path ?? path.join(dir, dirent.name))
            fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${dirent.name}</span><span class="file-modifiedAt" id="file-createdAt">${new Date(dirent.modifiedAt ?? dirent.trashDeletionDate).toLocaleString(navigator.language, { hour12: false })}</span>
            ${dirent.size > 0 ? `<span class="file-size" id="file-size">${formatBytes(dirent.size)}</span>` : `<span class="file-size" id="file-size"></span>`}
            <span class="file-type">${dirent.type}</span>
            `
            MAIN_ELEMENT.appendChild(fileGrid)

            ContextMenu(fileGrid, openFileWithDefaultApp, open)
        })
        if(options?.reveal || !fs.statSync(dir)?.isDirectory()){
            Select(document.querySelector<HTMLElement>(
                `[data-path="${escape(options?.initialDirToOpen)}"]`
            ), false, false, document.querySelectorAll(".file"))
        }

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
 * @param {boolean} boolean - Open the parent directory and select the file/dir
 * @returns {Promise<void>}
 */
const open = async (dir:string, reveal?:boolean):Promise<void> => {
    if (!dir) return

    const initialDirToOpen = dir;
    closePreviewFile()
    timeStarted = Date.now()
    startLoading()
    await changePosition(dir)
    if (dir === "xplorer://Home") {
        Home(() => {
            listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
            SelectListener(document.querySelectorAll(".file"))
            InfoLog(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
            console.log(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
        })
    } else if ( dir === "xplorer://Recent") {
        Recent()
    } else if ( dir === "xplorer://Trash") {
        const getFiles = () => {
            if (process.platform === "win32") {
                if (!fs.existsSync(WINDOWS_TRASH_FILES_PATH)) return []
                else {
                    return fs.readdirSync(WINDOWS_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => {
                        const fileInfo = fs.readFileSync(path.join(WINDOWS_TRASH_INFO_PATH, dirent.name + '.trashinfo'), 'utf8').split("\n")
                        let trashPath, trashDeletionDate;
                        if (fileInfo[0] === "[Trash Info]") {
                            trashPath = fileInfo[1].split('=')[1]
                            trashDeletionDate = fileInfo[2].split("=")[1]
                        }
                        const type = dirent.isDirectory() ? "File Folder" : getType(unescape(trashPath) ?? path.join(dir, dirent.name))
                        return { name: unescape(trashPath), isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)), trashPath, trashDeletionDate, type, isTrash: true, path: unescape(trashPath), realPath: path.join(WINDOWS_TRASH_FILES_PATH, dirent.name) };
                    })
                }
            } else {
                if (!fs.existsSync(LINUX_TRASH_FILES_PATH)) return []
                else {
                    return fs.readdirSync(LINUX_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => {
                        const fileInfo = fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, dirent.name + '.trashinfo'), 'utf8').split("\n")
                        let trashPath, trashDeletionDate;
                        if (fileInfo[0] === "[Trash Info]") {
                            trashPath = fileInfo[1].split('=')[1]
                            trashDeletionDate = fileInfo[2].split("=")[1]
                        }
                        const type = dirent.isDirectory() ? "File Folder" : getType(unescape(trashPath) ?? path.join(dir, dirent.name))
                        return { name: unescape(trashPath), isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)), trashPath, trashDeletionDate, type, isTrash: true, path: unescape(trashPath), realPath: path.join(LINUX_TRASH_FILES_PATH, dirent.name) };
                    })
                }
            }
        }
        const files = getFiles()
        displayFiles(files, process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH)
        // Watch the directory
        watcher?.close()
        fs.watch(process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH, async () => {
            const files = getFiles()
            // Get files of the dir
            displayFiles(files, process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH)
        })

    } else {
        if(reveal || !fs.statSync(dir)?.isDirectory()){
            dir = path.dirname(dir)
        }
        if (!fs.existsSync(dir)) {
            dialog.showMessageBoxSync({ message: `Xplorer can't find '${dir}'. Check the spelling and try again.`, type: "error" })
            ErrorLog(`${dir} does not exist.`)
            stopLoading()
            return;
        }
        const hideSystemFile = storage.get("preference")?.data?.hideSystemFiles ?? true
        let getAttributesSync:any; //eslint-disable-line
        if (process.platform === "win32") getAttributesSync = require("fswin").getAttributesSync; //eslint-disable-line
        const getFiles = () => {
            return fs.readdirSync(dir, { withFileTypes: true }).map(dirent => {
                const result:fileData = { name: dirent.name, isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)) }
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
        const files = getFiles()
        displayFiles(files, dir, {reveal, initialDirToOpen})
        // Watch the directory
        watcher?.close()
        watcher = fs.watch(dir, async (_, filePath) => {
            // Check if the file is under operation on Xplorer
            if(!ipcRenderer.sendSync('under-operation', path.join(dir, filePath))){
                const files = getFiles()
                // Get files of the dir
                displayFiles(files, dir)
            }
        })
    }
}
   

export { listenOpen, open, openFileWithDefaultApp, closeWatcher }