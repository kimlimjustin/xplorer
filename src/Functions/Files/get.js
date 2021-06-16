const fs = require('fs');
const storage = require("electron-json-storage-sync")
const path = require('path');
const { isHiddenFile } = require("is-hidden-file")

// Function to get all files and directory inside a directory
const getFilesAndDir = async (dir, callback) => {
    // Get files of the dir
    if (!dir.endsWith("\\") && process.platform === "win32") dir = dir + "\\"
    const files = fs.readdirSync(dir, { withFileTypes: true })
        .map(dirent => {
            try {
                const stat = fs.statSync(path.join(dir, dirent.name))
                return { "filename": dirent.name, "isDir": dirent.isDirectory(), "isHidden": isHiddenFile(dirent.name), "size": stat.size, "createdAt": stat.ctime, "modifiedAt": stat.mtime, "accessedAt": stat.atime }
            } catch(err) {
                return {"filename": dirent.name, "isDir": dirent.isDirectory() ,"isSystem": true, "isHidden": isHiddenFile(dirent.name)}
            }
        })
    //const files = readDir(dir)
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