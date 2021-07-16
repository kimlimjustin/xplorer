const path = require("path");
const fs = require("fs");
const os = require("os");
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info');
const { ErrorLog } = require('../Logs/log');


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

module.exports = { Restore }