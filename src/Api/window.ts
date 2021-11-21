import { window, event } from '@tauri-apps/api';
import { WebviewWindow } from '@tauri-apps/api/window';

const windowName = window.getCurrent().label;
const listenWindowClose = (): Promise<void> => {
	return new Promise((resolve) => {
		event.listen('tauri://close-requested', () => resolve());
	});
};

const createNewWindow = (): void => {
	new WebviewWindow(Math.random().toString(), {
		decorations: false,
		transparent: true,
		title: 'Xplorer',
	});
};

const changeWindowTitle = (title: string): void => {
	window.getCurrent().setTitle(`${title} - Xplorer`);
};

const setDecorations = (decorations: boolean): void => {
	window.getCurrent().setDecorations(decorations);
};

export default windowName;
export { listenWindowClose, createNewWindow, changeWindowTitle, setDecorations };
