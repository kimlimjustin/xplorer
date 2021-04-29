const nodeDiskInfo = require('../node-disk-info/index');
const fs = require('fs');
const path = require('path');
const formatBytes = require('../Functions/filesize.js');

const Drives = async () => {
    // Get all Physical disks Detected on the system
    const drives = await nodeDiskInfo.getDiskInfoSync()
    // Function to convert drives into HTML Tags
    const toElements = (drives, kBlockFormat = false) => {
        let result = "" // Element Result
        const iconJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/icon.json"))); // Read icon from preference
        drives.forEach((drive) => {
            let driveName = drive._mounted.split("/")[drive._mounted.split("/").length - 1] // Get name of drive
            result += `
            <div class="pendrive">
                <img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.usb}`)}" alt="Desktop icon" class="pendrive-icon">
                <div class="pendrive-info">
                    ${drive._volumename
                        ?`<h4 class="pendrive-title">${drive._volumename} (${driveName})</h4>`
                        :`<h4 class="pendrive-title">${driveName}</h4>`
                    }
                    <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${drive._capacity}"></span></div>
                    <p>${formatBytes(drive._available, kBlockFormat = kBlockFormat)} free of ${formatBytes(drive._blocks)}</p>
                </div>
            </div>
            `
        })
        return result;
    }
    if(process.platform === "linux"){
        // Get all USB Stick
        const USBStick = []
        drives.forEach(drive => {
            // If the drive is detected as physical disk...
            if(drive._filesystem.indexOf("/sdb") !== -1){
                // ... push it into the USB Stick array
                USBStick.push(drive)
            }
        })
        if(!USBStick.length) return "" // Return empty string if no USB plugged in
        else{
            return `
            <section class="main-section">
            <h1 class="pendrives-title">Pendrives</h1>
                ${USBStick.map((drive) => {
                    let driveName = drive._mounted.split("/")[drive._mounted.split("/").length - 1] // Get name of drive
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
    }else{
        return `
        <section class="main-section">
        <h1 class="pendrives-title">Drives</h1>
            ${toElements(drives)}
        </section>
        `
    }
}

module.exports =  Drives