const Tab = require('./Components/tab')
const updateTheme = require('./Functions/Theme/updateTheme');
const Home = require('./Components/home.js');
const windowManager = require('./Components/windowManager');
const {webFrame} = require('electron');
const {changeSidebar, Sidebar} = require('./Functions/DOM/sidebar');
const { openDir, listenOpen } = require('./Functions/Files/open');

// Wait DOM Content to be loaded
document.addEventListener('DOMContentLoaded', async () => {
    webFrame.setZoomFactor(1)
    changeSidebar(Sidebar())
    // Listen to minimze, maximize, exit and reload button
    windowManager()
    // Tab listener
    Tab()
    // Home Component as default view
    /*var _ = (function () {
        let homeExecuted = false; // only execute home once
        if (!homeExecuted) {
            Home(() => {
                listenOpen(document.querySelectorAll("[data-listenOpen]")) // Listen to open the file
                homeExecuted = true
            })
        }
        
    })()*/
    // Update the page theme
    updateTheme()
})
  