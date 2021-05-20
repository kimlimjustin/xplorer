const fs = require('fs');
const path = require('path');
const filterHidden = require('../Filter/hiddenFiles');

const IGNORE_FILE = ['desktop.ini']

// Function to get all files and directory inside a directory
const getFilesAndDir = async (dir, callback) => {
    // Get files of the dir
    const files = await fs.readdirSync(dir, { withFileTypes: true }).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory() } })
    // Filter hidden files
    filterHidden(files, dir, result => {
        callback(files)
    })
    // Watch the directory
    fs.watch(dir, async (eventType, filename) => {
        // Get files of the dir
        const files = await fs.readdirSync(dir, { withFileTypes: true }).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory() } })
        // Filter hidden files
        filterHidden(files, dir, result => {
            callback(files)
        })  
    })
}

module.exports = { getFilesAndDir }