const {remote} = require('electron');
const {changeTheme, getThemeJSON} = require("./theme.js");
const getDrives = require('./drives.ts');
const fs = require('fs');
const os = require('os');
const storage = require('electron-json-storage')

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
})
  