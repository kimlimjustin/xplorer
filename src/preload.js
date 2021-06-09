const { Tab } = require('./Components/tab')
const { updateTheme } = require('./Functions/Theme/theme');
const Home = require('./Components/home.js');
const windowManager = require('./Components/windowManager');
const {webFrame} = require('electron');
const createSidebar = require('./Components/sidebar');
const { listenOpen } = require('./Functions/Files/open');
const toggleHiddenFiles = require('./Functions/Files/toggleHiddenFiles');
const optionMenu = require('./Components/optionMenu');
const { ContextMenu } = require('./Components/contextMenu');

// Wait DOM Content to be loaded
document.addEventListener('DOMContentLoaded', async () => {
    webFrame.setZoomFactor(1)
    await createSidebar()
    // Listen to minimze, maximize, exit and reload button
    windowManager()
    // Tab listener
    Tab()
    // Home Component as default view
    var _ = (function () {
        let homeExecuted = false; // only execute home once
        if (!homeExecuted) {
            Home(() => {
                listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
                homeExecuted = true
            })
        }
        
    })()
    // Update the page theme
    updateTheme()
    // Initialize toggle hidden files feature
    toggleHiddenFiles()
    // Initialize option menu feature
    optionMenu()
    // Initialize context menu
    ContextMenu(document.getElementById("main"))
})
  