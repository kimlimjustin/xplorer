const storage = require('electron-json-storage')

// Function to handle option menu
const OptionMenu = (showMenu = true, path, callback) => {
    const toggleHiddenFiles = document.querySelector("#show-hidden-files")
    const menu = document.querySelector(".menu")
    if(showMenu) menu.style.display = "none"
    storage.get('hiddenFiles', (err, data) => {
        toggleHiddenFiles.checked = data[path]
        toggleHiddenFiles.addEventListener("change", e => {
            callback({checked: e.target.checked, type: "hide"})
        })
    })
    
}

module.exports = OptionMenu