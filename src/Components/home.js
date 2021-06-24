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

/**
 * Create home files section (only for linux)
 * @param {any} callback
 * @returns {any} home file section
 */
const homeFiles = (callback) => {
    const readHomeFiles = async () => {
        let result = `<section class='home-section'><h1 class="section-title">Files</h1>`;
        await fs.readdirSync(os.homedir(), { withFileTypes: true })
            .map(async dirent => {
                const stat = fs.statSync(path.join(os.homedir(), dirent.name))
                const preview = await getPreview(path.join(os.homedir(), dirent.name), category = dirent.isDirectory() ? "folder" : "file")
                result += `<div class="file-grid grid-hover-effect" draggable="true" data-isdir=${dirent.isDirectory()} data-path = "${escape(path.join(os.homedir(), dirent.name))}" data-listenOpen ${isHiddenFile(path.join(os.homedir(), dirent.name)) ? "data-hidden-file" : ""} data-tilt data-size="${stat.size}" data-created-at="${stat.ctime}" data-modified-at="${stat.mtime}" data-accessed-at="${stat.atime}">
                ${preview}
                <span class="file-grid-filename" id="file-filename">${Translate(dirent.name)}</span>
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

/**
 * Create contents for home page
 * @param {any} _callback - callback argument
 * @returns {any}
 */
const Home = async (_callback) => {
    startLoading()
    // Get the main element
    const MAIN_ELEMENT = document.getElementById("main");
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    const favorites = Favorites();
    const drives = await Drives();
    if (process.platform === "linux") {
        homeFiles(files => {
            console.log('a')
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
        const tabs = storage.get('tabs')?.data
        const focusingPath = tabs.tabs[tabs.focus]?.position
        if (focusingPath !== "Home" && focusingPath !== path.join(os.homedir(), 'Home')) {
            clearInterval(listenDrives)
        }
        previousDrive = _uniqueDrive
    }, 500);
}

module.exports = Home