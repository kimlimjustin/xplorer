const storage = require('electron-json-storage');
const Translate = require('../../Components/multilingual');

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
            toggleHiddenFiles.checked = !data[path]
            toggleHiddenFiles.addEventListener("change", e => {
                callback({checked: e.target.checked, type: "hide"})
            })
        })
    })
}

module.exports = OptionMenu