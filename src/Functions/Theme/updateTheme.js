const storage = require('electron-json-storage')
const {changeTheme, getThemeJSON} = require("./theme.js");
// Function to update page theme
const updateTheme = () => {
    // Change window theme
    storage.get('theme', (err, data) => {
        // If user has no preference theme
        if(!data || !Object.keys(data).length){
            // Detect system theme
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                storage.set("theme", {theme: "dark"})
                changeTheme(document, "dark")
            }else{
                storage.set("theme", {theme: "light"})
                changeTheme(document, "light")
            }
        }else{
            const themeJSON = getThemeJSON()
            // Check if the theme available
            if(Object.keys(themeJSON).indexOf(data.theme) !== -1){
                changeTheme(document, data.theme)
            }
            else{ // If the theme not available
                // Detect system theme
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    storage.set("theme", {theme: "dark"})
                    changeTheme(document, "dark")
                }else{
                    storage.set("theme", {theme: "light"})
                    changeTheme(document, "light")
                }
            }
        }
    })
}

module.exports = updateTheme