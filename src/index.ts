import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import createSidebar from './Components/Layout/sidebar';
import Home from './Components/Layout/home';
import { detectDriveInit } from './Components/Drives/drives';
import { OpenInit } from './Components/Open/open';
import { Tab } from './Components/Layout/tab';
// Wait DOM Loaded to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	// Listen to minimize, maximize, exit and reload button
	windowManager();
	// Initialize drive detection
	detectDriveInit();
	// Build sidebar
	createSidebar();
	// Initialize Home Page
	Home();
	// Initialize Tabs
	Tab();
	// Update the page styling
	updateTheme();
	// Initialize open dir/files listener
	OpenInit();
});
