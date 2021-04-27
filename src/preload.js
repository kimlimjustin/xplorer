const {remote} = require('electron');
const changeTheme = require("./theme.js");
const getDrives = require('./drives.ts');
const fs = require('fs');
const os = require('os');

document.addEventListener('DOMContentLoaded', () => {
    // Change window theme
    changeTheme(document, 'light')

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
})
  