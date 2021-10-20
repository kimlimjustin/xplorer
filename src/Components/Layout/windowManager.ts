//import { open } from '../Files/File Operation/open';
//import windowGUID from '../Constants/windowGUID';
import { appWindow } from '@tauri-apps/api/window';
/**
 * Reload the page
 * @returns {void}
 */
const reload = (): void => {
	//const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	/*open(tabs.tabs[tabs.focus].position);
	closePreviewFile();
	document.querySelector<HTMLElement>('.properties').style.animation =
		'close-properties 1s forwards';*/
	console.log('a');
};

/**
 * Minimize Xplorer window
 * @returns {void}
 */
const minimize = (): void => {
	appWindow.minimize();
};

/**
 * Maximize Xplorer window
 * @returns {void}
 */
const maximize = (): void => {
	appWindow.maximize();
};

/**
 * Window manager initializer function
 * @returns {void}
 */
const windowManager = (): void => {
	// Minimize the screen
	document.querySelector('#minimize').addEventListener('click', minimize);
	// Maximize the screen
	document.querySelector('#maximize').addEventListener('click', maximize);
	// Exit window
	document.querySelector('#exit').addEventListener('click', () => {
		appWindow.close();
	});

	// Refresh the page
	document.querySelector('#refresh').addEventListener('click', reload);

	/*document
		.querySelector('.path-navigator')
		.addEventListener(
			'change',
			(event: Event & { target: HTMLInputElement }) => {
				open(event.target.value);
			}
		);*/
};

export { windowManager, reload, minimize, maximize };
