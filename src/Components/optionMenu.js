const storage = require('electron-json-storage-sync');
const userPreference = storage.get('preference')?.data // Read user preference

const optionMenu = () => {
    document.getElementById("show-hidden-files").checked = !userPreference?.hideHiddenFiles
    document.getElementById("show-hidden-files").addEventListener("change", e => {
        let hideHiddenFiles = !e.target.checked;
        storage.set('preference', Object.assign({}, userPreference, { hideHiddenFiles }))
        document.getElementById("main").dataset.hideHiddenFiles = hideHiddenFiles
    })
}

module.exports = optionMenu