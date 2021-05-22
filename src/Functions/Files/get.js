const fs = require('fs');
const path = require('path');
const filterHidden = require('../Filter/hiddenFiles');
const storage = require("electron-json-storage-sync")

const IGNORE_FILE = ['desktop.ini']

// Function to get all files and directory inside a directory
const getFilesAndDir = async (dir, callback) => {
    // Get files of the dir
    const files = await fs.readdirSync(dir, { withFileTypes: true }).filter(dirent => IGNORE_FILE.indexOf(dirent.name) === -1).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory() } })
    // Filter hidden files
    filterHidden(files, dir, result => {
        callback(files)
    })
    // Watch the directory
    const watcher = fs.watch(dir, async (eventType, filename) => {
        // Get files of the dir
        const files = await fs.readdirSync(dir, { withFileTypes: true }).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory() } })
        // Filter hidden files
        filterHidden(files, dir, result => {
            callback(files)
        })
    })

    let focusingPath; // Watch if focusing path changes
    setInterval(() => {
        const tabs = storage.get('tabs')?.data
        const _focusingPath = tabs.tabs[tabs.focus]
        if (focusingPath === undefined) {
            focusingPath = _focusingPath
        } else {
            if (focusingPath !== _focusingPath) {
                watcher.close()
            }
        }
    }, 500);
}

module.exports = { getFilesAndDir }