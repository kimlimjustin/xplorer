import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import createSidebar from './Components/Layout/sidebar';
import Home from './Components/Layout/home';
// Wait DOM Loaded to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	// Listen to minimize, maximize, exit and reload button
	windowManager();
	// Build sidebar
	createSidebar();
	Home();
	// Update the page styling
	updateTheme();
});
