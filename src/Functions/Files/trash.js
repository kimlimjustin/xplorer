const path = require("path");
const fs = require("fs");
const os = require("os");
const { ErrorLog } = require('../Logs/log');
const trash = require("trash");
const LINUX_TRASH_FILES_PATH = path.join(os.homedir(), '.local/share/Trash/files')
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info');

/**
 * Restore file/folder from trash
 * @param {any} filePath - file you want to restore
 * @returns {any}
 */
const Restore = (filePath) => {
    const fileInfo = fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, path.basename(filePath) + '.trashinfo'), "utf8")
    const trashSourcePath = fileInfo.split("\n")[1].split("=")[1]
    fs.rename(filePath, trashSourcePath, (err) => {
        if (err) ErrorLog(err)
    })
    fs.unlink(path.join(LINUX_TRASH_INFO_PATH, path.basename(filePath) + '.trashinfo'), (err) => {
        if (err) ErrorLog(err)
    })
}

/**
 * Move file/folder into trash
 * @param {any} filePath - file you want to delete
 * @returns {any}
 */
const Trash = (filePaths) => {
    for (const filePath of filePaths) {
        let target;
        /*fs.readdirSync(LINUX_TRASH_INFO_PATH).forEach(info => {
            if (info.startsWith(path.basename(filePath))) {
                const __extension = info.split(".")
                let __sameNameCount = 0
                if (String(parseInt(__extension[__extension.length - 2])) === __extension[__extension.length - 2]) {
                    __sameNameCount = __extension[__extension.length - 2]
                }
                console.log(__sameNameCount)
                target = __extension.splice(0, __extension.length - 2).join(".")
                console.log(target, info)
            }
        })*/
        /*fs.rename(filePath, LINUX_TRASH_FILES_PATH, (err) => {
            if (err) ErrorLog(err)
        })*/
        trash(filePath)
    }
}

module.exports = { Restore, Trash }