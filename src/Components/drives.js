const nodeDiskInfo = require('../node-disk-info/index');
const fs = require('fs');
const path = require('path');
const formatBytes = require('../Functions/filesize.js');

const Drives = async () => {
    // Get all Physical disks Detected on the system
    const drives = await nodeDiskInfo.getDiskInfoSync()
    // Get all USB Stick
    const USBStick = []
    drives.forEach(drive => {
        // If the drive is detected as physical disk...
        if(drive._filesystem.indexOf("/sdb") !== -1){
            // ... push it into the USB Stick array
            USBStick.push(drive)
        }
    })
    if(process.platform === "linux"){
        if(!USBStick.length) return "" // Return empty string if no USB plugged in
        else{
            const iconJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/icon.json")));
            return `
            <section class="main-section">
            <h1 class="pendrives-title">Pendrives</h1>
                ${USBStick.map((drive) => {
                    let driveName = drive._mounted.split("/")[drive._mounted.split("/").length - 1]
                    return `
                    <div class="pendrive">
                        <img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.usb}`)}" alt="Desktop icon" class="pendrive-icon">
                        <div class="pendrive-info">
                            <h4 class="pendrive-title">${driveName}</h4>
                            <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${drive._capacity}"></span></div>
                            <p>${formatBytes(drive._available, kBlockFormat = true)} free of ${formatBytes(drive._blocks, kBlockFormat = true)}</p>
                        </div>
                    </div>
                    `
                })}
            </section>
            `
        }
    }else return ""
}

module.exports =  Drives