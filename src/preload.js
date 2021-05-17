const Tab = require('./Components/tab')
const updateTheme = require('./Functions/Theme/updateTheme');
const Home = require('./Components/home.js');
const windowManager = require('./Components/windowManager');
const {webFrame} = require('electron');
const {changeSidebar, Sidebar} = require('./Functions/DOM/sidebar');

// Wait DOM Content to be loaded
document.addEventListener('DOMContentLoaded', () => {
    webFrame.setZoomFactor(1)
    changeSidebar(Sidebar())
    // Listen to minimze, maximize, exit and reload button
    windowManager()
    // Tab listener
    Tab()
    // Home Component as default view
    Home()
    // Update the page theme
    updateTheme()
})
  