/* eslint-disable no-mixed-spaces-and-tabs */
import { updateTheme } from './Components/Theme/theme';
import { ipcRenderer, webFrame } from 'electron';
import createSidebar from './Components/Layout/sidebar';
import { windowManager } from './Components/Layout/windowManager';
import Home from './Components/Layout/home';
import { open } from './Components/Files/File Operation/open';
import ContextMenu from './Components/ContextMenu/contextMenu';
import { createNewTab, Tab } from './Components/Layout/tab';
import { toggleHiddenFiles } from './Components/Functions/toggleHiddenFiles';
import optionMenu from './Components/Layout/optionMenu';
import { SelectListener } from './Components/Files/File Operation/select';
import { Shortcut } from './Components/Shortcut/shortcut';
import path from 'path';
import fs from 'fs';
import Hover from './Components/Layout/hover';

const args = ipcRenderer.sendSync('args');
if (args.listen && args.theme) {
	args.theme =
		args.listen?.length > 0
			? args.listen
			: path.join(
					process.cwd(),
					JSON.parse(
						fs.readFileSync(
							path.join(process.cwd(), 'package.json'),
							'utf-8'
						)
					).main
			  );
}

const requestedOpen = args._;

// Wait DOM Content to be loaded
document.addEventListener('DOMContentLoaded', async () => {
	webFrame.setZoomFactor(1);
	await createSidebar();
	// Listen to minimze, maximize, exit and reload button
	windowManager();
	// Tab listener
	Tab();
	if (!requestedOpen.length) {
		// Home Component as default view
		(function () {
			let homeExecuted = false; // only execute home once
			if (!homeExecuted) {
				Home(() => {
					SelectListener(document.querySelectorAll('.file'));
					homeExecuted = true;
				});
			}
		})();
	} else {
		open(path.resolve(requestedOpen[0]), args.r);
		for (let i = 1; i < requestedOpen.length; i++) {
			createNewTab(path.resolve(requestedOpen[i]));
		}
	}
	// Update the page theme
	if (args?.theme) updateTheme(args.theme);
	// Initialize toggle hidden files feature
	toggleHiddenFiles();
	// Initialize option menu feature
	optionMenu();
	// Initialize context menu
	ContextMenu();
	// Initialize shortcut
	Shortcut();
	// Initialize hover handler
	Hover();
});
