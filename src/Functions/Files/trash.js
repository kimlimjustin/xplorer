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
    let fileInfo;
    let __uuid;
    if (fs.existsSync(path.join(LINUX_TRASH_INFO_PATH, path.basename(filePath) + '.trashinfo'))) {
        fileInfo = fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, path.basename(filePath) + '.trashinfo'), "utf8")
    } else {
        fs.readdirSync(LINUX_TRASH_INFO_PATH).forEach(info => {
            if (unescape(fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, info), "utf-8").split("\n")[1].split("=")[1]) === filePath) {
                fileInfo = fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, info), "utf-8")
                __uuid = info.split(".").splice(0, info.split(".").length - 1).join(".");
            }
        })
    }
    const trashSourcePath = fileInfo.split("\n")[1].split("=")[1]
    fs.rename(path.join(LINUX_TRASH_FILES_PATH, __uuid ?? path.basename(filePath)), unescape(trashSourcePath), (err) => {
        if (err) ErrorLog(err)
    })
    fs.unlink(path.join(LINUX_TRASH_INFO_PATH, __uuid ? __uuid + '.trashinfo' : path.basename(filePath) + '.trashinfo'), (err) => {
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
        trash(filePath)
    }
}

module.exports = { Restore, Trash }