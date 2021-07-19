const path = require("path");
const fs = require("fs");
const os = require("os");
const { ErrorLog } = require('../Logs/log');
const trash = require("trash");
const LINUX_TRASH_FILES_PATH = path.join(os.homedir(), '.local/share/Trash/files')
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info');
const WINDOWS_TRASH_FILES_PATH = "C:\\Trash/files";
const WINDOWS_TRASH_INFO_PATH = "C:\\Trash/info";
const FILES_PATH = process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH
const INFO_PATH = process.platform === "win32" ? WINDOWS_TRASH_INFO_PATH : LINUX_TRASH_INFO_PATH
const uuid = require("uuid");

/**
 * Restore file/folder from trash
 * @param {any} filePath - file you want to restore
 * @returns {any}
 */
const Restore = (filePath) => {
    let fileInfo;
    let __uuid;
    if (fs.existsSync(path.join(INFO_PATH, path.basename(filePath) + '.trashinfo'))) {
        fileInfo = fs.readFileSync(path.join(INFO_PATH, path.basename(filePath) + '.trashinfo'), "utf8")
    } else {
        fs.readdirSync(INFO_PATH).forEach(info => {
            if (unescape(fs.readFileSync(path.join(INFO_PATH, info), "utf-8").split("\n")[1].split("=")[1]) === filePath) {
                fileInfo = fs.readFileSync(path.join(INFO_PATH, info), "utf-8")
                __uuid = info.split(".").splice(0, info.split(".").length - 1).join(".");
            }
        })
    }
    const trashSourcePath = fileInfo.split("\n")[1].split("=")[1]
    fs.rename(path.join(FILES_PATH, __uuid ?? path.basename(filePath)), unescape(trashSourcePath), (err) => {
        if (err) ErrorLog(err)
    })
    fs.unlink(path.join(INFO_PATH, __uuid ? __uuid + '.trashinfo' : path.basename(filePath) + '.trashinfo'), (err) => {
        if (err) ErrorLog(err)
    })
}

const pad = number => number < 10 ? '0' + number : number;

const getDeletionDate = date => date.getFullYear() +
	'-' + pad(date.getMonth() + 1) +
	'-' + pad(date.getDate()) +
	'T' + pad(date.getHours()) +
	':' + pad(date.getMinutes()) +
	':' + pad(date.getSeconds());


/**
 * Move file/folder into trash
 * @param {any} filePath - file you want to delete
 * @returns {any}
 */
const Trash = (filePaths) => {
    for (const filePath of filePaths) {
        if (process.platform === "win32") {
            const name = uuid.v4()
            const destination = path.join(WINDOWS_TRASH_FILES_PATH, name);
	        const trashInfoPath = path.join(WINDOWS_TRASH_INFO_PATH, `${name}.trashinfo`);
            if (!fs.existsSync(WINDOWS_TRASH_FILES_PATH)) {
                fs.mkdirSync(WINDOWS_TRASH_FILES_PATH, {recursive: true})
            }
            if (!fs.existsSync(WINDOWS_TRASH_INFO_PATH)) {
                fs.mkdirSync(WINDOWS_TRASH_INFO_PATH, {recursive: true})
            }
            fs.rename(filePath, destination, (err) => {
                if (err) ErrorLog(err)
            })
            const trashInfoData = `[Trash Info]\nPath=${filePath.replace(/\s/g, '%20')}\nDeletionDate=${getDeletionDate(new Date())}`;
            fs.writeFileSync(trashInfoPath, trashInfoData)
        } else {
            trash(filePath)
        }
    }
}

module.exports = { Restore, Trash }