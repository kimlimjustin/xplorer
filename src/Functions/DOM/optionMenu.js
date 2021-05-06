const storage = require('electron-json-storage');
const Translate = require('../../Components/multilingual');

// Check user preference to show or hidden file
const checkUserPreference = (path, callback) => {
    // Get user preference from the storage
    storage.get('hiddenFiles', (err, data) => {
        // If user has no preference theme
        if(!data || !Object.keys(data).length || Object.keys(data).indexOf(path) === -1){
            if(data && Object.keys(data).indexOf("default") !== -1) callback(data.default) // _Check if there's user default preference
            else callback(true) // Else send true if need to filter hidden files as default
        }else{
            if(data[path]) callback(true)
            else callback(false)
        }
    })
}

// Function to handle option menu
const OptionMenu = (showMenu = true, path, callback) => {
    const menu = document.querySelector(".menu")
    if(showMenu) menu.style.display = "none"

    // Translate text inside menu
    Translate(menu.innerHTML, navigator.language, (translated) => {
        menu.innerHTML = translated
        // Get user preference
        storage.get('hiddenFiles', (err, data) => {
            const toggleHiddenFiles = document.querySelector("#show-hidden-files")
            checkUserPreference(path, preference => {
                toggleHiddenFiles.checked = !preference
                toggleHiddenFiles.addEventListener("change", e => {
                    callback({checked: e.target.checked, type: "hide"})
                })
            })
        })
    })
}

module.exports = OptionMenu