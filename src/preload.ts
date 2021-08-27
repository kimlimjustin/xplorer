import { updateTheme } from './Functions/Theme/theme';
import { webFrame } from 'electron';
import createSidebar from './Components/sidebar';
import { windowManager } from './Components/windowManager';
import Home from './Components/home';
import { listenOpen } from './Functions/Files/open';
import { ContextMenu } from './Components/contextMenu';
import { Tab } from './Components/tab';
import { toggleHiddenFiles } from './Functions/Files/toggleHiddenFiles';
import optionMenu from './Components/optionMenu';
import { SelectListener } from './Functions/Files/select';
import { Shortcut } from './Components/shortcut';

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
