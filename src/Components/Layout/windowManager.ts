import { appWindow } from '@tauri-apps/api/window';
import Storage from '../../Api/storage';
import windowGUID from '../Constants/windowGUID';
import { OpenDir } from '../Files/File Operation/open';
/**
 * Reload the page
 * @returns {Promise<void>}
 */
const reload = async (): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowGUID}`);
	open(tabs.tabs[tabs.focus].position);
	//closePreviewFile();
	document.querySelector<HTMLElement>('.properties').style.animation =
		'close-properties 1s forwards';
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
 * Close Xplorer window
 * @returns {any}
 */
const close = (): void => {
	Storage.remove(`tabs-${windowGUID}`);
	appWindow.close();
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
	document.querySelector('#exit').addEventListener('click', close);

	// Refresh the page
	document.querySelector('#refresh').addEventListener('click', reload);

	document
		.querySelector('.path-navigator')
		.addEventListener(
			'change',
			(event: Event & { target: HTMLInputElement }) => {
				OpenDir(event.target.value);
			}
		);
};

export { windowManager, reload, minimize, maximize, close };
