const {remote} = require('electron');
const {getCurrentWindow, globalShortcut} = remote
// Function to reload
const reload = () => {
    getCurrentWindow().reload()
}

const windowManager = () => {
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
}

module.exports = windowManager