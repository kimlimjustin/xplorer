const nodeDiskInfo = require('./node-disk-info/index');

const getDrives = async () => {
    const drives = await nodeDiskInfo.getDiskInfoSync()
    return drives
}

module.exports =  getDrives