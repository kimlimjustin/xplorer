import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import createSidebar from './Components/Layout/sidebar';
document.addEventListener('DOMContentLoaded', async () => {
	windowManager();
	updateTheme();
	createSidebar();
});
