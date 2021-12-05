import { appWindow } from '@tauri-apps/api/window';
import Storage from '../../Api/storage';
import windowName, { listenWindowClose, setDecorations } from '../../Api/window';
import { OpenDir } from '../Open/open';
import focusingPath from '../Functions/focusingPath';
import getDirname from '../Functions/path/dirname';
import createSidebar from './sidebar';
import { updateTheme } from '../Theme/theme';
/**
 * Reload the page
 * @returns {Promise<void>}
 */
const reload = async (): Promise<void> => {
	const tabs = await Storage.get(`tabs-${windowName}`);
	OpenDir(tabs.tabs[tabs.focus].position);
	//closePreviewFile();
	document.querySelector<HTMLElement>('.properties').style.animation = 'close-properties 1s forwards';
	createSidebar();
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
 * @returns {Promise<void>}
 */
const maximize = async (): Promise<void> => {
	if (await appWindow.isMaximized()) appWindow.unmaximize();
	else appWindow.maximize();
};

/**
 * Close Xplorer window
 * @returns {any}
 */
const close = (): void => {
	appWindow.close();
};

/**
 * Go to parent directory of current focusing path
 * @returns {Promise<void>}
 */
const goParentDir = async (): Promise<void> => {
	const dirName = getDirname(await focusingPath());
	if (dirName && !dirName.startsWith('xplorer://')) OpenDir(getDirname(await focusingPath()));
	else OpenDir('xplorer://Home');
};

/**
 * Window manager initializer function
 * @returns {Promise<void>}
 */
const windowManager = async (): Promise<void> => {
	const appearance = await Storage.get('appearance');
	if (appearance?.frameStyle === 'os') {
		document.querySelector('.window-manager').parentNode.removeChild(document.querySelector('.window-manager'));
	}
	setDecorations(appearance?.frameStyle === 'os');
	// Minimize the screen
	document.querySelector('#minimize')?.addEventListener('click', minimize);
	// Maximize the screen
	document.querySelector('#maximize')?.addEventListener('click', maximize);
	// Exit window
	document.querySelector('#exit')?.addEventListener('click', close);

	// Refresh the page
	document.querySelector('#refresh').addEventListener('click', reload);

	document.querySelector('#go-parent-dir').addEventListener('click', goParentDir);

	document.querySelector('.path-navigator').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		OpenDir(event.target.value);
	});
	updateTheme('windowmanager');
	const _preference = await Storage.get('preference');
	listenWindowClose().then(() => {
		if (_preference?.on_startup === 'new') Storage.remove(`tabs-${windowName}`);
		Storage.remove(`operations-${windowName}`);
		Storage.remove('clipboard');
	});
};

export { windowManager, reload, minimize, maximize, close };
