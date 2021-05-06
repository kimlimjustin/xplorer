const {remote} = require('electron');
const {getCurrentWindow, globalShortcut} = remote
// Function to reload
const reload = () => {
    getCurrentWindow().reload()
}

// Function to minimize window
const minimize = () => {
    const electronWindow = remote.BrowserWindow.getFocusedWindow()
    electronWindow.minimize()
}

// Function to maximize window
const maximize = () => {
    const electronWindow = remote.BrowserWindow.getFocusedWindow()
    !electronWindow.isMaximized() ? electronWindow.maximize() : electronWindow.unmaximize()
}

const windowManager = () => {
    // Minimize the screen
    document.querySelector("#minimize").addEventListener("click", minimize)
    // Maximize the screen
    document.querySelector("#maximize").addEventListener("click", maximize)
    // Exit window
    document.querySelector("#exit").addEventListener("click", () => {
        const electronWindow = remote.BrowserWindow.getFocusedWindow()
        electronWindow.close()
    })

    // Refresh the page
    document.querySelector("#refresh").addEventListener("click",reload)
    globalShortcut.register("F5", reload)
    globalShortcut.register("CommandOrControl+R", reload);
    globalShortcut.register("F10", minimize);
    globalShortcut.register("Alt+Down", minimize);
    globalShortcut.register("F11", maximize);
    globalShortcut.register("Alt+Up", maximize);
    // Remove shortcut from the current window to avoid multiple reload on the new window
    window.addEventListener("beforeunload", () => {
        globalShortcut.unregister("F5", reload)
        globalShortcut.unregister("CommandOrControl+R", reload);
        globalShortcut.unregister("F10", minimize);
        globalShortcut.unregister("Alt+Down", minimize);
        globalShortcut.unregister("F11", maximize);
        globalShortcut.unregister("Alt+Up", maximize);
    })
}

module.exports = windowManager