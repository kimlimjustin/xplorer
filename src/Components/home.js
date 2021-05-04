const os = require('os');
const Drives = require('./drives.js');
const Favorites = require('./favorites.js');
const changeContent = require("../Functions/DOM/changeContent");
const updateTheme = require('../Functions/Theme/updateTheme');
const {getFilesAndDir} = require('../Functions/Files/get');
const hideFiles = require('../Functions/Filter/hideFiles.js');

// Home files for linux
const homeFiles = (callback) => {
    getFilesAndDir(os.homedir(), files => {
        let result = `<section class='home-section'><h1 class="section-title">Files</h1>`;
        files.forEach(file => {
            result += `<div class="file-grid">
            ${file.filename}
            </div>`
        })
        callback(result + "</section>")
    })
}
// Content for home page
const Home = () => {
    // Create a new main element
    const newMainElement = document.createElement("div");

    let previousDrive; // Previous drive tags (used to detect USB Drive changes)
    let globalFavorites; // Global variable to store favorites
    let globalDrives; // Global variable to store drives

    // Hide files shorcut
    const hideFilesShortcut = e => {
        if(e.ctrlKey && e.key === "h"){
            hideFiles(os.homedir(), () => {
                homeFiles(files => {
                    // Add home files into home page
                    newMainElement.innerHTML = globalFavorites + globalDrives + files
                    changeContent(newMainElement)
                    updateTheme()
                })
            })
        }
    }

    const _homeFiles = (drives) => {
        globalDrives = drives // Save drives into global variable
        Favorites(favorites => {
            globalFavorites = favorites; // Save favorites into global variable
            if (process.platform === "linux") {
                homeFiles(files => {
                    // Update the content in the main page ...
                    newMainElement.innerHTML = favorites + drives + files
                    changeContent(newMainElement)
                    // And also the theme :)
                    updateTheme()
                    document.addEventListener("keyup", hideFilesShortcut, false)
                })
            }
            else{
                // Update the content in the main page ...
                newMainElement.innerHTML = favorites + drives
                changeContent(newMainElement)
                // And also the theme :)
                updateTheme()
            }
        })
    }

    // Detecting USB Drive changes every 500 ms
    setInterval(() => {
        Drives().then(drives => {
            if (previousDrive === undefined) {
                previousDrive = drives
            } else {
                // If the drives change ...
                if (previousDrive !== drives) {
                    _homeFiles(drives)
                    document.removeEventListener("keyup", hideFilesShortcut, false)
                }
            }
            previousDrive = drives
        })
    }, 500)

    Drives().then(drives => {
        _homeFiles(drives)
    })
}

module.exports = Home