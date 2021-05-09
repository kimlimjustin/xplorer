const fs = require('fs');
const path = require('path');
const filterHidden = require('../Filter/hiddenFiles');


// Function to get all files and directory inside a directory
const getFilesAndDir = async (dir, callback) => {
    let result = []
    // Get files of the dir
    const files = await fs.readdirSync(dir)
    files.forEach(file => {
        // Check if the file is a dir
        const isDir = fs.lstatSync(path.join(dir, file)).isDirectory()
        result.push({ filename: file, isDir })
    })
    // Filter hidden files
    filterHidden(result, dir, result => {
        callback(result)
    })
    // Watch the directory
    fs.watch(dir, async (eventType, filename) => {
        let result = []
        // Get files of the dir
        const files = await fs.readdirSync(dir)
        files.forEach(file => {
            // Check if the file is a dir
            const isDir = fs.lstatSync(path.join(dir, file)).isDirectory()
            result.push({ filename: file, isDir })
        })
        // Filter hidden files
        filterHidden(result, dir, result => {
            callback(result)
        })  
    })
}

module.exports = { getFilesAndDir }