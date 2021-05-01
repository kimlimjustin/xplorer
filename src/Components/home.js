const Drives = require('./drives.js');
const Favorites = require('./favorites.js');
const changeContent = require("../Functions/DOM/changeContent");
const updateTheme = require('../Functions/Theme/updateTheme');
// Content for home page
const Home = () => {
    // Create a new main element
    const newMainElement = document.createElement("div");

    let previousDrive; // Previous drive tags (used to detect USB Drive changes)
    // Detecting USB Drive changes every 500 ms
    setInterval(() => {
        Drives().then(drives => {
            if(previousDrive === undefined){
                previousDrive = drives
            }else{
                // If the drives change ...
                if(previousDrive !== drives){
                    Favorites(favorites => {
                        // Update the content in the main page ...
                        newMainElement.innerHTML = favorites + drives
                        changeContent(newMainElement)
                        // And also the theme :)
                        updateTheme()
                    })
                }
            }
            previousDrive = drives
        })
    }, 500)

    Drives().then(drives => {
        Favorites(favorites => {
            newMainElement.innerHTML = favorites + drives
            changeContent(newMainElement)
        })
    })
}

module.exports = Home