import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import createSidebar from './Components/Layout/sidebar';
import Home from './Components/Layout/home';
import { detectDriveInit } from './Components/Drives/drives';
import { OpenDir, OpenInit } from './Components/Open/open';
import { createNewTab, Tab } from './Components/Layout/tab';
import { Shortcut } from './Components/Shortcut/shortcut';
import { SelectInit } from './Components/Files/File Operation/select';
import CLIInformations from './Api/cli';
import Storage from './Api/storage';
import Setting from './Components/Setting/setting';
// Wait DOM Loaded to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	// Listen to minimize, maximize, exit and reload button
	windowManager();
	// Initialize drive detection
	detectDriveInit();
	// Build sidebar
	createSidebar();
	// Initialize Tabs
	Tab();
	// Initialize folder to open
	const cli = await CLIInformations();
	if (!cli.args.length) {
		Home();
	} else {
		let reveal = false;
		if (cli.flags.indexOf('--reveal') !== -1 || cli.flags.indexOf('-r') !== -1) {
			reveal = true;
		}
		OpenDir(cli.args[0], reveal);
		for (let i = 1; i < cli.args.length; i++) {
			createNewTab(cli.args[i]);
		}
	}
	// Update the page styling
	updateTheme();
	// Initialize open dir/files listener
	OpenInit();
	// Intialize shortcuts
	Shortcut();
	// Initialize select files listener
	SelectInit();
	// Initialize user preference
	const _preference = await Storage.get('preference');
	document.getElementById('workspace').dataset.hideHiddenFiles = String(_preference.hideHiddenFiles ?? true);
	// Initialize settings
	Setting();
});
