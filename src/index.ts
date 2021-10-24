import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import createSidebar from './Components/Layout/sidebar';
import Home from './Components/Layout/home';
import { detectDriveInit } from './Components/Drives/drives';
import { OpenInit } from './Components/Files/File Operation/open';
//import DirectoryAPI from './Api/directory';
// Wait DOM Loaded to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	// Listen to minimize, maximize, exit and reload button
	windowManager();
	// Initialize drive detection
	detectDriveInit();
	// Build sidebar
	createSidebar();
	// Initialized Home Page
	Home();
	// Update the page styling
	updateTheme();
	/*document
		.querySelector('.path-navigator')
		.addEventListener(
			'change',
			async (event: Event & { target: HTMLInputElement }) => {
				console.time(event.target.value);
				console.log(
					await new DirectoryAPI(event.target.value).getFiles()
				);
				console.timeEnd(event.target.value);
			}
		);*/
	OpenInit();
});
