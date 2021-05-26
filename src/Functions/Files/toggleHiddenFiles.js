const storage = require('electron-json-storage-sync');
const userPreference = storage.get('preference')?.data // Read user preference
let hideHiddenFiles = userPreference ? userPreference?.hideHiddenFiles : true // Hide hidden files as default
    
const __init__ = () => {
    document.getElementById("main").dataset.hideHiddenFiles = hideHiddenFiles
}

const toggleHiddenFiles = () => {
    __init__()
    // Shortcut support for toggle hidden files
    const Shortcut = e => {
        if (e.ctrlKey && e.key === "h") {
            hideHiddenFiles = !hideHiddenFiles
            storage.set('preference', Object.assign({}, userPreference, { hideHiddenFiles }))
            document.getElementById("main").dataset.hideHiddenFiles = hideHiddenFiles
        }
    }
    document.addEventListener("keyup", Shortcut, false)
}

module.exports = toggleHiddenFiles