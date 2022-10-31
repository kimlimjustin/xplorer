import Translate from '../I18n/i18n';
import Storage from '../../Service/storage';
import windowName, { listenWindowClose, setDecorations } from '../../Service/window';
import { OpenDir } from '../Open/open';
import focusingPath from '../Functions/focusingPath';
import getDirname from '../Functions/path/dirname';
import createSidebar from './sidebar';
import isTauri from '../../Util/is-tauri';
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
	if (isTauri) {
		const { appWindow } = require('@tauri-apps/api/window');
		appWindow.minimize();
	}
};

/**
 * Maximize Xplorer window
 * @returns {Promise<void>}
 */
const maximize = async (): Promise<void> => {
	if (isTauri) {
		const { appWindow } = require('@tauri-apps/api/window');
		if (await appWindow.isMaximized()) appWindow.unmaximize();
		else appWindow.maximize();
	}
};

/**
 * Close Xplorer window
 * @returns {any}
 */
const close = (): void => {
	if (isTauri) {
		const { appWindow } = require('@tauri-apps/api/window');
		appWindow.close();
	}
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
	if (appearance?.frameStyle === 'os' || !isTauri) {
		document.querySelector('.window-manager').parentNode.removeChild(document.querySelector('.window-manager'));
	}
	setDecorations(appearance?.frameStyle !== 'default');
	// Minimize the screen
	document.querySelector('#minimize')?.addEventListener('click', minimize);
	document.querySelector('#minimize')?.setAttribute('title', await Translate('Minimize'));
	// Maximize the screen
	document.querySelector('#maximize')?.addEventListener('click', maximize);
	document.querySelector('#maximize')?.setAttribute('title', await Translate('Maximize'));
	// Exit window
	document.querySelector('#exit')?.addEventListener('click', close);
	document.querySelector('#exit')?.setAttribute('title', await Translate('Exit (Ctrl + w)'));

	// Refresh the page
	document.querySelector('#refresh').addEventListener('click', reload);
	document.querySelector('#refresh')?.setAttribute('title', await Translate('Reload (f5)'));

	document.querySelector('#go-parent-dir').addEventListener('click', goParentDir);
	document.querySelector('#go-parent-dir')?.setAttribute('title', await Translate('Parent Directory (Alt + Up Arrow)'));
	document.querySelector('#go-back')?.setAttribute('title', await Translate('Go Back (Alt + Left Arrow)'));
	document.querySelector('#go-forward')?.setAttribute('title', await Translate('Go Forward (Alt + Right Arrow)'));

	document.querySelector('.path-navigator').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		OpenDir(event.target.value);
	});
	const _preference = await Storage.get('preference');
	listenWindowClose().then(() => {
		if (_preference?.on_startup === 'new') Storage.remove(`tabs-${windowName}`);
		Storage.remove(`operations-${windowName}`);
		Storage.remove('clipboard');
	});
};

export { windowManager, reload, minimize, maximize, close };
