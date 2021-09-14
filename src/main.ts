import {
	BrowserWindow as ElectronBrowserWindow,
	app,
	ipcMain,
	screen,
	shell,
	nativeTheme,
} from 'electron';
//import { BrowserWindow as ArcylicWindow, Vibrancy } from 'electron-acrylic-window';
import path from 'path';
import storage from 'electron-json-storage-sync';
import * as remoteInit from '@electron/remote/main';
import isDev from 'electron-is-dev';
import os from 'os';

/**
 * Initialize Acrylic's BrowserWindow if available
 */
let BrowserWindow: any; //eslint-disable-line
if (
	process.platform !== 'win32' ||
	!(storage.get('theme')?.data?.acrylic ?? true)
) {
	BrowserWindow = ElectronBrowserWindow;
} else {
	BrowserWindow = require('electron-acrylic-window').BrowserWindow; //eslint-disable-line
}
/**
 * Initialize electron reloader
 */
if (isDev) {
	try {
		const electronReloader = require('electron-reloader'); //eslint-disable-line
		electronReloader(module);
	} catch (err) {
		console.log('Err: ' + err);
	}
}
/**
 * Initialize electron's remote
 */
remoteInit.initialize();

/**
 * Communication between main and prelaod
 */

let win: any; //eslint-disable-line
const FILES_ON_OPERATION: string[] = [];
let id: string;

ipcMain.on('args', (e) => {
	e.returnValue = isDev ? process.argv.slice(2) : process.argv.slice(1);
});
ipcMain.on('GUID', (_, arg: string) => {
	id = arg;
});
ipcMain.on('operation', (_, arg: string) => {
	FILES_ON_OPERATION.push(arg);
	console.log(FILES_ON_OPERATION);
});
ipcMain.on('operation-done', (e, arg: string) => {
	const index = FILES_ON_OPERATION.indexOf(arg);
	if (index > -1) FILES_ON_OPERATION.splice(index, 1);
	e.returnValue = true;
});
ipcMain.on('under-operation', (e, arg: string) => {
	e.returnValue = FILES_ON_OPERATION.indexOf(arg) !== -1;
});
ipcMain.on('update-theme', () => {
	win.setVibrancy(
		isVibrancySupported()
			? vibrancy()
			: storage.get('theme')?.data?.category ?? 'white'
	);
});

function isVibrancySupported() {
	// Windows 10 or greater
	return (
		process.platform === 'win32' &&
		parseInt(os.release().split('.')[0]) >= 10
	);
}
const detectDefaultTheme = (): string => {
	if (nativeTheme.shouldUseDarkColors) {
		return 'dark';
	} else {
		return 'light';
	}
};

const vibrancy = () => {
	return {
		disableOnBlur: false,
		theme: storage.get('theme')?.data?.category
			? storage.get('theme')?.data?.category === 'dark'
				? '#1b1e2e88'
				: '#ffffff88'
			: detectDefaultTheme(),
		effect: 'acrylic',
		useCustomWindowRefreshMethod: true,
		debug: false,
	};
};

// Create a new window
function createWindow() {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	win = new BrowserWindow({
		title: 'xplorer',
		frame: false,
		width: Math.floor(width * 0.8),
		height: Math.floor(height * 0.8),
		minWidth: 600,
		minHeight: 400,
		vibrancy: isVibrancySupported()
			? vibrancy()
			: storage.get('theme')?.data?.category ?? 'white',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			enableRemoteModule: true,
		},
	});

	win.loadFile(isDev ? './Public/index.html' : 'outs/src/Public/index.html');
	//win.webContents.openDevTools({ mode: 'detach' });
	win.webContents.on(
		'new-window',
		(e: Electron.NewWindowWebContentsEvent, url: string) => {
			e.preventDefault();
			shell.openExternal(url);
		}
	);
}

app.allowRendererProcessReuse = false;

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	storage.remove(`tabs-${id}`);
	storage.remove(`operations-${id}`);
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

interface dragOptions {
	[key: string]: string;
}

ipcMain.on(
	'ondragstart',
	(event: Electron.IpcMainEvent, filePath: string, options: dragOptions) => {
		event.sender.startDrag({
			file: filePath,
			icon: options.isDir
				? path.join(__dirname, 'Icon/folder.png')
				: path.join(__dirname, 'Icon/file.png'),
		});
	}
);
