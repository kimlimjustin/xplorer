const nodeDiskInfo = require('../../lib/node-disk-info/index');
const path = require('path');
const formatBytes = require('../Functions/Math/filesize.js');
const Translate = require("../Components/multilingual");
const getPreview = require('../Functions/preview/preview');
const getDriveBasePath = require('../Functions/Files/basePath');

/**
 * Function to get array of drives detected on the system
 * @returns {Array} drives detected on the system
 */
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

/**
 * Get unique drives regardless space 
 * @param {Array} drives - drives array
 * @returns {Array} unique drives array
 */
const getUniqueDrives = drives => {
    let result = []
    drives.forEach(drive => result.push({ _filesystem: drive._filesystem, _mounted: drive._filesystem, _volumename: drive._volumename || drive._filesystem }))
    return result;
}

/**
 * Function to convert drives into HTML Tags
 * @param {Array} drives - Array of drives
 * @param {boolean} kBlockFormat - Is drive size presented as K-block-format (1024*n)? (optional)
 * @returns {any}
 */
const drivesToElements = (drives, kBlockFormat = false) => {
    let result = drives.length ? `<h1 class="section-title">${Translate(process.platform === "linux" ? "Pendrives" : "Drives")}</h1>` : "" // Element Result
    drives.forEach((drive) => {
        let driveName = drive._mounted.split("/")[drive._mounted.split("/").length - 1] // Get name of drive
        result += `
        <div class="pendrive card-hover-effect" data-tilt data-isdir="true" data-listenOpen data-path = "${getDriveBasePath(drive._mounted)}">
            <img src="${getPreview(drive._filesystem === "Removable Disk" ? 'usb' : 'hard-disk', category = "favorites", HTMLFormat = false)}" alt="USB icon" class="pendrive-icon">
            <div class="pendrive-info">
                ${drive._volumename || drive._filesystem
                ? `<h4 class="pendrive-title">${drive._volumename || drive._filesystem} (${driveName})</h4>`
                : `<h4 class="pendrive-title">${driveName}</h4>`
            }
                <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${drive._capacity}"></span></div>
                <p>${formatBytes(drive._available, kBlockFormat = kBlockFormat)} ${Translate("free of")} ${formatBytes(drive._blocks, kBlockFormat = kBlockFormat)}</p>
            </div>
        </div>
        `
    })
    return result;
}

/**
 * Create drives elements
 * @returns {string} drive section HTML code
 */
const Drives = async () => {
    const storage = require('electron-json-storage-sync');
    const os = require('os');

    const drives = await getDrives()

    const tabs = storage.get('tabs')?.data
    const focusingPath = tabs.tabs[tabs.focus].position

    if (focusingPath === "Home" || focusingPath === path.join(os.homedir(), 'Home')) {
        switch (process.platform) {
            case "win32":
                return `<section class="home-section" id="drives">${drivesToElements(drives)}</section>`
            case "darwin":
                return '' // Xplorer does not support drives for macOS recently
            default:
                return `<section class="home-section" id="drives">${drivesToElements(drives, kBlockFormat = true)}</section>`
        }
    }
}

module.exports = { Drives, getDrives, getUniqueDrives, drivesToElements }