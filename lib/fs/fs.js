const path = require('path');
const { execSync } = require("child_process")
const exeSrc = __dirname.indexOf('app.asar') !== -1 ? path.join(__dirname.replace('\\app.asar', ''), 'fs.exe') : path.join(__dirname, 'fs.exe')
const storage = require('electron-json-storage-sync');

const IGNORE_FILE = ['.', '..']
// Function to get files/folders inside a directory
const filesystem = DirPath => {
    const hideSystemFile = storage.get('preference')?.data?.hideSystemFile === undefined ? true : storage.get('preference')?.data?.hideSystemFile // Check user preference on hiding protected OS file
    // Check a file is hidden by using the c++ program if the platform is win32
    if (process.platform === "win32") {
        if (!DirPath.endsWith("\\")) DirPath = DirPath + "\\" // Add '\' character at the end of the string if it's not ended with '\'
        DirPath += "\\" // ! Add '\' character at the end to not escape the " caracter !
        const result = []
        const files = new TextDecoder().decode(execSync(`${exeSrc} "${DirPath}"`))
        for (const file of files.split("\n").slice(1)) { // Format output
            const fileInfo = file.split("|")
            if (fileInfo.length === 8) { // Check if match format
                if (IGNORE_FILE.indexOf(fileInfo[0].trim()) === -1) { // If the file is not being ignored
                    let filename = fileInfo[0].trim()
                    let isHidden = !!+fileInfo[1].trim()
                    let isDir = !!+fileInfo[2].trim()
                    let isSystemFile = !!+fileInfo[3].trim()
                    let size = +fileInfo[4].trim()
                    let createdAt = fileInfo[5].trim()
                    let modifiedAt = fileInfo[6].trim()
                    let accessedAt = fileInfo[7].trim()
                    if (!(isSystemFile && hideSystemFile)) {
                        result.push({ filename, isHidden, isDir, isSystemFile, size, createdAt, modifiedAt, accessedAt })
                    }
                } 
            }
        }
        return result;
    }
    const fs = require('fs');
    return fs.readdirSync(DirPath, { withFileTypes: true }).filter(dirent => IGNORE_FILE.indexOf(dirent.name) === -1).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory(), "isHidden": /(^|\/)\.[^\/\.]/g.test(dirent.name) } })
}

module.exports = filesystem