const os = require('os');
const path = require('path');
const { Drives, getDrives, getUniqueDrives, drivesToElements } = require('./drives.js');
const Favorites = require('./favorites.js');
const { updateTheme } = require('../Functions/Theme/theme');
const fs = require("fs");
const Translate = require('../Components/multilingual');
const nativeDrag = require('../Functions/DOM/drag.js');
const getPreview = require('../Functions/preview/preview.js');
const { startLoading, stopLoading } = require('../Functions/DOM/loading.js');
const storage = require('electron-json-storage-sync');
const LAZY_LOAD = require('../Functions/DOM/lazyLoadingImage.js');
const { createContextMenus } = require('./contextMenu.js');
const { isHiddenFile } = require('is-hidden-file');
const getType = require('../Functions/Files/type.js');
const formatBytes = require('../Functions/Math/filesize.js');
const windowGUID = require('../Constants/windowGUID')

/**
 * Create home files section (only for linux)
 * @param {any} callback
 * @returns {any} home file section
 */
const homeFiles = (callback) => {
    const readHomeFiles = async () => {
        const dirAlongsideFiles = storage.get("preference")?.data?.dirAlongsideFiles ?? false
        const layout = storage.get("layout")?.data?.[os.homedir()] ?? storage.get("preference")?.data?.layout ?? "s"
        const sort = storage.get("sort")?.data?.[os.homedir()] ?? 'A'
        let result = `<section class='home-section'><h1 class="section-title">Files</h1>`;
        let files = fs.readdirSync(os.homedir(), { withFileTypes: true }).map(dirent => {
            let result = { name: dirent.name, isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(os.homedir(), dirent.name)) }
            const type = dirent.isDirectory() ? "File Folder" : getType(path.join(os.homedir(), dirent.name))
            result.type = type
            const stat = fs.statSync(path.join(os.homedir(), dirent.name))
            result.createdAt = stat.ctime
            result.modifiedAt = stat.mtime
            result.accessedAt = stat.atime
            result.size = stat.size
            return result
        })
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
        await files.forEach(async file => {
            const preview = await getPreview(path.join(os.homedir(), file.name), category = file.isDir ? "folder" : "file")
            let className = "file file-grid grid-hover-effect"
            switch (layout) {
                case "m":
                    className += " medium-grid-view"
                    break;
                case "l":
                    className += " large-grid-view"
                    break;
                case "d":
                    className += " detail-view"
                    break;
                default:
                    className += " small-grid-view"
                    break;
            }
            result += `<div class="${className}" draggable="true" data-isdir=${file.isDir} data-path = "${escape(path.join(os.homedir(), file.name))}" data-listenOpen ${isHiddenFile(path.join(os.homedir(), file.name)) ? "data-hidden-file" : ""} data-tilt data-size="${file.size}" data-created-at="${file.createdAt}" data-modified-at="${file.modifiedAt}" data-accessed-at="${file.accessedAt}">
            ${preview}
            <span class="file-grid-filename" id="file-filename">${Translate(file.name)}</span><span class="file-modifiedAt" id="file-createdAt">${new Date(file.modifiedAt).toLocaleString(navigator.language, { hour12: false })}</span>
            ${file.size > 0 ? `<span class="file-size" id="file-size">${formatBytes(file.size)}</span>` : `<span class="file-size" id="file-size"></span>`}
            </div>`

        })
        callback(result + "</section>")
    }
    readHomeFiles()

    // Watch the directory
    const watcher = fs.watch(os.homedir(), async (eventType, filename) => {
        readHomeFiles()
    })

    let focusingPath; // Watch if focusing path changes
    setInterval(() => {
        const tabs = storage.get(`tabs-${windowGUID}`)?.data
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

/**
 * Create contents for home page
 * @param {any} _callback - callback argument
 * @returns {any}
 */
const Home = async (_callback) => {
    startLoading()
    // Get the main element
    const MAIN_ELEMENT = document.getElementById("workspace");
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    const favorites = Favorites();
    const drives = await Drives();
    if (process.platform === "linux") {
        homeFiles(files => {
            // Update the content in the main page ...
            MAIN_ELEMENT.innerHTML = favorites + drives + files

            createContextMenus(document.querySelectorAll(".file"))
            // And also the theme :)
            updateTheme()
            nativeDrag(document.querySelectorAll('.file'), os.homedir()) // Listen to native drag
            _callback()
            stopLoading()
            LAZY_LOAD()
        })
    }
    else {
        // Update the content in the main page ...
        MAIN_ELEMENT.innerHTML = favorites + drives
        // And also the theme :)
        updateTheme()
        _callback()
        stopLoading()
    }
    let previousDrive;
    // Function to listen changes of drives
    let listenDrives = setInterval(async () => {
        const _drives = await getDrives()
        let _uniqueDrive = getUniqueDrives(_drives)
        if (previousDrive === undefined) {
            previousDrive = _uniqueDrive
        } else {
            if (JSON.stringify(_uniqueDrive) !== JSON.stringify(previousDrive)) {
                if (document.getElementById("drives").classList.contains('hidden')) document.getElementById("drives").classList.remove('hidden')
                document.getElementById("drives").innerHTML = drivesToElements(_drives)
                updateTheme()
            }
        }
        const tabs = storage.get(`tabs-${windowGUID}`)?.data
        const focusingPath = tabs.tabs[tabs.focus]?.position
        if (focusingPath !== "Home" && focusingPath !== path.join(os.homedir(), 'Home')) {
            clearInterval(listenDrives)
        }
        previousDrive = _uniqueDrive
    }, 500);
}

module.exports = Home