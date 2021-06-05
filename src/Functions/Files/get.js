const fs = require('fs');
const storage = require("electron-json-storage-sync")
const { readDir } = require("../../../bindings");

// Function to get all files and directory inside a directory
const getFilesAndDir = async (dir, callback) => {
    // Get files of the dir
    if (!dir.endsWith("\\")) dir = dir + "\\"
    const files = readDir(dir)
    //console.log(files)
    callback(files)
    // Watch the directory
    const watcher = fs.watch(dir, async (eventType, filename) => {
        // Get files of the dir
        const files = fscpp(dir)
        callback(files)
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

module.exports = { getFilesAndDir }