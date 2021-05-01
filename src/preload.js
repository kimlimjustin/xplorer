const Tab = require('./Components/tab')
const updateTheme = require('./Functions/Theme/updateTheme');
const Home = require('./Components/home.js');
const windowManager = require('./Components/windowManager');

// Wait DOM Content to be loaded
document.addEventListener('DOMContentLoaded', () => {
    // Listen to minimze, maximize, exit and reload button
    windowManager()
    // Tab listener
    Tab()
    // Home Component as default view
    Home()
    // Update the page theme
    updateTheme()
})
  