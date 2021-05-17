const nodeDiskInfo = require('../../lib/node-disk-info/index');
const fs = require('fs');
const path = require('path');
const formatBytes = require('../Functions/Math/filesize.js');
const Translate = require("../Components/multilingual");
const getPreview = require('../Functions/preview/preview');

// Function to get array of drives detected on the system
const getDrives = async () => {
    // Get all Physical disks Detected on the system
    const drives = await nodeDiskInfo.getDiskInfoSync()
    // Get all USB Stick (for Linux and macOS)
    const USBStick = []
    drives.forEach(drive => {
        // If the drive is detected as not-first physical disk...
        if (drive._filesystem.indexOf("/sda") === -1 && drive._filesystem.indexOf("tmpfs") === -1) {
            // ... push it into the USB Stick array
            USBStick.push(drive)
        }
    })
    return process.platform === "win32" ? drives : USBStick
}

const Drives = async (callback) => {
    const drives =  await getDrives()
    // Function to convert drives into HTML Tags
    const toElements = (drives, kBlockFormat = false) => {
        let result = "" // Element Result
        const iconJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/icon.json"))); // Read icon from preference
        drives.forEach((drive) => {
            let driveName = drive._mounted.split("/")[drive._mounted.split("/").length - 1] // Get name of drive
            result += `
            <div class="pendrive" data-tilt>
                <img src="${getPreview('usb', category = "favorites", HTMLFormat = false)}" alt="USB icon" class="pendrive-icon">
                <div class="pendrive-info">
                    ${drive._volumename
                    ? `<h4 class="pendrive-title">${drive._volumename} (${driveName})</h4>`
                    : `<h4 class="pendrive-title">${driveName}</h4>`
                }
                    <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${drive._capacity}"></span></div>
                    <p>${formatBytes(drive._available, kBlockFormat = kBlockFormat)} free of ${formatBytes(drive._blocks, kBlockFormat = kBlockFormat)}</p>
                </div>
            </div>
            `
        })
        return result;
    }
    switch(process.platform){
        case "win32":
            Translate(`<section class="home-section"><h1 class="section-title">Drives</h1>${toElements(drives)}</section>`, navigator.language, translated => callback(translated))
            break;
        case "darwin":
            callback('') // Xplorer does not support drives for macOS recently
            break;
        default:
            Translate(`<section class="home-section"><h1 class="section-title">Pendrives</h1>${toElements(drives, kBlockFormat = true)}</section>`, navigator.language, translated => callback(drives.length ? translated : ""))
    }
}

module.exports = {Drives, getDrives}