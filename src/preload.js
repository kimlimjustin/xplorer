const fs = require('fs');
const {remote} = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    const theme = JSON.parse(fs.readFileSync("src/config/theme.json"));
    // Styling
    document.body.style.backgroundColor =  theme.default.mainBackground
    document.body.style.color = theme.default.textColor
    document.body.style.fontSize = theme.default.fontSize
    document.querySelector(".tabs-manager").style.backgroundColor = theme.default.tabsManager
    document.querySelector(".sidebar").style.backgroundColor = theme.default.sidebarBackground
    document.querySelector("#minimize").style.backgroundColor = theme.default.minimizeBackgroundColor
    document.querySelector("#minimize").style.color = theme.default.minimizeColor
    document.querySelector("#maximize").style.backgroundColor = theme.default.maximizeBackgroundColor
    document.querySelector("#maximize").style.color = theme.default.maximizeColor
    document.querySelector("#exit").style.backgroundColor = theme.default.exitBackgroundColor
    document.querySelector("#exit").style.color = theme.default.exitColor

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
    document.querySelector("#exit").addEventListener("click", () => {
        const electronWindow = remote.BrowserWindow.getFocusedWindow()
        electronWindow.close()
    })
})
  