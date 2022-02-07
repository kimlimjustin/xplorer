import isTauri from '../Util/is-tauri';
let windowName: string;
if (isTauri) {
	const window = require('@tauri-apps/api/window');
	windowName = window.getCurrent().label;
} else windowName = location.pathname;

const listenWindowClose = (): Promise<void> => {
	if (isTauri) {
		const { event } = require('@tauri-apps/api');
		return new Promise((resolve) => {
			event.listen('tauri://close-requested', () => {
				const { appWindow } = require('@tauri-apps/api/window');
				resolve();
				appWindow.close();
			});
		});
	} else {
		return new Promise((resolve) => {
			window.addEventListener('beforeunload', () => {
				resolve();
			});
		});
	}
};

const createNewWindow = (): void => {
	if (isTauri) {
		const { WebviewWindow } = require('@tauri-apps/api/window');
		new WebviewWindow(Math.random().toString(), {
			decorations: false,
			transparent: true,
			title: 'Xplorer',
		});
	}
};

const changeWindowTitle = (title: string): void => {
	if (isTauri) {
		const { window } = require('@tauri-apps/api');
		window.getCurrent().setTitle(`${title} - Xplorer`);
	} else document.title = `${title} - Xplorer`;
};

const setDecorations = (decorations: boolean): void => {
	if (isTauri) {
		const { window } = require('@tauri-apps/api');
		window.getCurrent().setDecorations(decorations);
	}
};
const listenUpdateTheme = (cb: () => void): void => {
	if (isTauri) {
		const { event } = require('@tauri-apps/api');
		event.listen('update_theme', () => cb());
	}
};

export default windowName;
export { listenWindowClose, createNewWindow, changeWindowTitle, setDecorations, listenUpdateTheme };
