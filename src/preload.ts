import { updateTheme } from './Components/Theme/theme';
import { webFrame } from 'electron';
import createSidebar from './Components/Layout/sidebar';
import { windowManager } from './Components/Layout/windowManager';
import Home from './Components/Layout/home';
import { listenOpen } from './Components/Files/File Operation/open';
import { ContextMenu } from './Components/Context Menu/contextMenu';
import { Tab } from './Components/Layout/tab';
import { toggleHiddenFiles } from './Components/Functions/toggleHiddenFiles';
import optionMenu from './Components/Layout/optionMenu';
import { SelectListener } from './Components/Files/File Operation/select';
import { Shortcut } from './Components/Shortcut/shortcut';

// Wait DOM Content to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	webFrame.setZoomFactor(1);
	await createSidebar();
	// Listen to minimze, maximize, exit and reload button
	windowManager();
	// Tab listener
	Tab();
	// Home Component as default view
	(function () {
		let homeExecuted = false; // only execute home once
		if (!homeExecuted) {
			Home(() => {
				listenOpen(document.querySelectorAll('[data-listenOpen]')); // Listen to open the file
				SelectListener(document.querySelectorAll('.file'));
				homeExecuted = true;
			});
		}
	})();
	// Update the page theme
	updateTheme();
	// Initialize toggle hidden files feature
	toggleHiddenFiles();
	// Initialize option menu feature
	optionMenu();
	// Initialize context menu
	ContextMenu(document.getElementById('workspace'));
	// Initialize shortcut
	Shortcut();
});
