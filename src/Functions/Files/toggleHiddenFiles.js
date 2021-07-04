const storage = require('electron-json-storage-sync');
const userPreference = storage.get('preference')?.data // Read user preference
let hideHiddenFiles = userPreference ? userPreference?.hideHiddenFiles : true // Hide hidden files as default

const __init__ = () => {
    document.getElementById("main").dataset.hideHiddenFiles = hideHiddenFiles
}

const getHideHiddenFilesValue = () => hideHiddenFiles
const toggleHideHiddenFilesValue = () => {
    hideHiddenFiles = !hideHiddenFiles
}

/**
 * Show/hide hidden files
 * @returns {any}
 */
const toggleHiddenFiles = () => {
    __init__()
}

module.exports = { toggleHiddenFiles, getHideHiddenFilesValue, toggleHideHiddenFilesValue }