const fs = require('fs');
const storage = require("electron-json-storage-sync")
const { readDir } = require("../../../lib/wasm/bindings");

// Function to get all files and directory inside a directory
const getFilesAndDir = async (dir, callback) => {
    // Get files of the dir
    if (!dir.endsWith("\\") && process.platform === "win32") dir = dir + "\\"
    const files = readDir(dir)
    callback(files)
    // Watch the directory
    const watcher = fs.watch(dir, async (eventType, filename) => {
        // Get files of the dir
        const files = readDir(dir)
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