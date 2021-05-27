const path = require('path');
const { execSync } = require("child_process")
const exeSrc = __dirname.indexOf('app.asar') !== -1 ? path.join(__dirname.replace('\\app.asar', ''), 'fs.exe') : path.join(__dirname, 'fs.exe')

const IGNORE_FILE = ['desktop.ini', '.', '..']
// ! This is a platform specific function !
const filesystem = FilePath => {
    // Check a file is hidden by using the c++ program if the platform is win32
    if (process.platform === "win32") {
        if (!FilePath.endsWith("\\")) FilePath = FilePath + "\\" // Add '\' character at the end of the string if it's not ended with '\'
        FilePath += "\\" // ! Add '\' character at the end to not escape the " caracter !
        const result = []
        const files = new TextDecoder().decode(execSync(`${exeSrc} "${FilePath}"`))
        for (const file of files.split("\n").slice(1)) { // Format output
            const fileInfo = file.split("|")
            if (fileInfo.length === 3) { // Check if match format
                if (IGNORE_FILE.indexOf(fileInfo[0].trim()) === -1) result.push({ filename: fileInfo[0].trim(), isHidden: !!+fileInfo[1].trim(), isDir: !!+fileInfo[2].trim() })
            }
        }
        return result;
    }
    const fs = require('fs');
    return fs.readdirSync(FilePath, { withFileTypes: true }).filter(dirent => IGNORE_FILE.indexOf(dirent.name) === -1).map(dirent => { return { "filename": dirent.name, "isDir": dirent.isDirectory(), "isHidden": /(^|\/)\.[^\/\.]/g.test(dirent.name) } })
}

module.exports = filesystem