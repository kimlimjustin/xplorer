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
import ContextMenu from './Components/ContextMenu/contextMenu';
import Hover from './Components/Layout/hover';
import LAZY_LOAD_INIT from './Components/Functions/lazyLoadingImage';
import Infobar from './Components/Layout/infobar';
import Search from './Components/Files/File Operation/search';
import { Resizer } from './Components/Layout/resizer';
import { listenUpdateTheme } from './Api/window';
// Wait DOM Loaded to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	// Read user preferences
	const _preference = await Storage.get('preference');
	// Listen to minimize, maximize, exit and reload button
	windowManager();
	// Initialize drive detection
	detectDriveInit();
	// Build sidebar
	createSidebar();
	// Initialize folder to open
	const cli = await CLIInformations();
	if (!cli.dirs.length) {
		if ((_preference?.on_startup ?? 'new') === 'new') {
			Home();
		}
		// Initialize Tabs
		Tab();
	} else {
		OpenDir(cli.dirs[0], cli.is_reveal);
		for (let i = 1; i < cli.dirs.length; i++) {
			createNewTab(cli.dirs[i]);
		}

		// Initialize Tabs
		Tab(cli.is_reveal);
	}
	// Update the page styling
	if (cli.custom_style_sheet) {
		updateTheme('root', cli.custom_style_sheet);
	} else {
		updateTheme('root');
	}
	// Initialize open dir/files listener
	OpenInit();
	// Intialize shortcuts
	Shortcut();
	// Initialize select files listener
	SelectInit();
	// Initialize user preference
	document.getElementById('workspace').dataset.hideHiddenFiles = String(_preference?.hideHiddenFiles ?? true);
	// Initialize settings
	Setting();
	// Initialize info bar
	Infobar();
	// Initialize context menu
	ContextMenu();
	// Initialize hover handler
	Hover();
	// Initialize search feature
	Search();
	// Initialize lazy loading image handler (for performance)
	LAZY_LOAD_INIT();
	// Initialize sidebar resizer
	Resizer();
	// Listen to update theme event
	listenUpdateTheme(async () => {
		await Storage.get('theme', true);
		await Storage.get('extensions', true);
		updateTheme('*');
	});
});
