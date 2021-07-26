const storage = require('electron-json-storage-sync');
const Translate = require('./multilingual');
const userPreference = storage.get('preference')?.data // Read user preference

/**
 * Option menu initializer
 * @returns {any}
 */
const optionMenu = () => {
    document.querySelector("[for='show-hidden-files']").innerText = Translate(document.querySelector("[for='show-hidden-files']").innerText)
    document.getElementById("show-hidden-files").checked = !userPreference?.hideHiddenFiles
    document.getElementById("show-hidden-files").addEventListener("change", e => {
        let hideHiddenFiles = !e.target.checked;
        storage.set('preference', Object.assign({}, userPreference, { hideHiddenFiles }))
        document.getElementById("workspace").dataset.hideHiddenFiles = hideHiddenFiles
    })
}

module.exports = optionMenu