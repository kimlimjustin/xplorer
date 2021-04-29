const {remote} = require('electron');
const {changeTheme, getThemeJSON} = require("./theme.js");
const Drives = require('./Components/drives.js');
const fs = require('fs');
const os = require('os');
const storage = require('electron-json-storage')
const {getCurrentWindow, globalShortcut} = remote
const Favorites = require('./Components/favorites.ts');
// Function to change main element content
const changeContent = newElement => {
    newElement.id = "main";
    const mainElement = document.body.querySelector("#main");
    mainElement.parentElement.replaceChild(newElement, mainElement);
}

// Function to reload
const reload = () => {
    getCurrentWindow().reload()
}

document.addEventListener('DOMContentLoaded', () => {
    // Minimize the screen
    document.querySelector("#minimize").addEventListener("click", () => {
        const electronWindow = remote.BrowserWindow.getFocusedWindow()
        electronWindow.minimize()
    })
    // Maximize the screen
    document.querySelector("#maximize").addEventListener("click", () => {
        const electronWindow = remote.BrowserWindow.getFocusedWindow()
        !electronWindow.isMaximized() ? electronWindow.maximize() : electronWindow.unmaximize()
    })
    // Exit window
    document.querySelector("#exit").addEventListener("click", () => {
        const electronWindow = remote.BrowserWindow.getFocusedWindow()
        electronWindow.close()
    })

    // Refresh the page
    document.querySelector("#refresh").addEventListener("click",reload)
    globalShortcut.register("F5", reload)
    globalShortcut.register("CommandOrControl+R", reload);
    // Remove shortcut from the current window to avoid multiple reload on the new window
    window.addEventListener("beforeunload", () => {
        globalShortcut.unregister("F5", reload)
        globalShortcut.unregister("CommandOrControl+R", reload);
    })

    // Closing tab
    document.querySelectorAll(".tab").forEach(tab => {
        const closeTab = document.createElement("span");
        closeTab.innerHTML = "&times;"
        closeTab.classList.add("close-tab-btn");
        // Listen to close tab button
        closeTab.addEventListener("click", () => {
            // Close the window if user close the only tab
            if(document.querySelectorAll(".tab").length === 1){
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            }else{
                tab.parentElement.removeChild(tab)
            }
        })
        tab.appendChild(closeTab)
    })

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
                    changeTheme(document, "dark")
                }
            }else{
                const themeJSON = getThemeJSON()
                // Check if the theme available
                if(themeJSON.availableThemes.indexOf(data.theme) !== -1){
                    changeTheme(document, data.theme)
                }
                else{ // If the theme not available
                    // Detect system theme
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        storage.set("theme", {theme: "dark"})
                        changeTheme(document, "dark")
                    }else{
                        storage.set("theme", {theme: "light"})
                        changeTheme(document, "dark")
                    }
                }
            }
        })
    }
    // Content for home page
    const homePage = () => {
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
                        // Update the content in the main page ...
                        newMainElement.innerHTML = Favorites() + drives
                        changeContent(newMainElement)
                        // And also the theme :)
                        updateTheme()
                    }
                }
                previousDrive = drives
            })
        }, 500)

        Drives().then(drives => {
            newMainElement.innerHTML = Favorites() + drives
            changeContent(newMainElement)
        })
    }
    homePage()
    updateTheme()
})
  