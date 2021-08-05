const { openDir } = require('../Functions/Files/open')
const storage = require('electron-json-storage-sync')
const remote = require("@electron/remote")
const createSidebar = require('./sidebar')
const { closePreviewFile } = require('../Functions/Files/preview')

/**
 * Reload the page
 * @returns {any}
 */
const reload = async () => {
    const tabs = storage.get('tabs')?.data
    await createSidebar()
    openDir(tabs.tabs[tabs.focus].position);
    closePreviewFile()
}

/**
 * Minimize Xplorer window
 * @returns {any}
 */
const minimize = () => {
    const electronWindow = remote.BrowserWindow.getFocusedWindow()
    electronWindow.minimize()
}

/**
 * Maximize Xplorer window
 * @returns {any}
 */
const maximize = () => {
    const electronWindow = remote.BrowserWindow.getFocusedWindow()
    !electronWindow.isMaximized() ? electronWindow.maximize() : electronWindow.unmaximize()
}

/**
 * Window manager initializer function
 * @returns {any}
 */
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
    document.querySelector("#refresh").addEventListener("click", reload)

    document.querySelector(".path-navigator").addEventListener("change", ({ target: { value } }) => {
        openDir(value)
    })
}

module.exports = { windowManager, reload, minimize, maximize }