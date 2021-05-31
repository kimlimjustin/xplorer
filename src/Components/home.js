const os = require('os');
const path = require('path');
const { Drives, getDrives, getUniqueDrives, drivesToElements } = require('./drives.js');
const Favorites = require('./favorites.js');
const { updateTheme } = require('../Functions/Theme/theme');
const { getFilesAndDir } = require('../Functions/Files/get');
const Translate = require('../Components/multilingual');
const nativeDrag = require('../Functions/DOM/drag.js');
const getPreview = require('../Functions/preview/preview.js');
const { startLoading, stopLoading } = require('../Functions/DOM/loading.js');
const storage = require('electron-json-storage-sync');
const LAZY_LOAD = require('../Functions/DOM/lazyLoadingImage.js');
const { createContextMenus } = require('./contextMenu.js');

// Home files for linux
const homeFiles = (callback) => {
    getFilesAndDir(os.homedir(), async files => {
        let result = `<section class='home-section'><h1 class="section-title">Files</h1>`;
        for (const file of files) {
            const preview = await getPreview(path.join(os.homedir(), file.filename), category = file.isDir ? "folder" : "file")
            result += `<div class="file-grid file-hover-effect" draggable="true" data-isdir=${file.isDir} data-path = "${escape(path.join(os.homedir(), file.filename))}" data-listenOpen ${file.isHidden ? "data-hidden-file" : ""}>
            ${preview}
            <span class="file-grid-filename" id="file-filename">${Translate(file.filename)}</span>
            </div>`
        }
        callback(result + "</section>")
    })
}
// Content for home page
const Home = async (_callback) => {
    startLoading()
    // Get the main element
    const MAIN_ELEMENT = document.getElementById("main");
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    const favorites = Favorites();
    const drives = await Drives();
    if (process.platform === "linux") {
        homeFiles(files => {
            // Update the content in the main page ...
            MAIN_ELEMENT.innerHTML = favorites + drives + files

            createContextMenus(document.querySelectorAll(".file-grid"))
            // And also the theme :)
            updateTheme()
            nativeDrag(document.querySelectorAll('.file-grid'), os.homedir()) // Listen to native drag
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
        const focusingPath = tabs.tabs[tabs.focus]
        if (focusingPath !== "Home" && focusingPath !== path.join(os.homedir(), 'Home')) {
            clearInterval(listenDrives)
        }
        previousDrive = _uniqueDrive
    }, 500);
}

module.exports = Home