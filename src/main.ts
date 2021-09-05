import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'path';
import storage from 'electron-json-storage-sync';
import * as remoteInit from '@electron/remote/main';
import isDev from 'electron-is-dev';
if (isDev) {
	try {
		const electronReloader = require('electron-reloader'); //eslint-disable-line
		electronReloader(module);
	} catch (err) {
		console.log('Err: ' + err);
	}
}
remoteInit.initialize();

console.log(process.argv);

const FILES_ON_OPERATION: string[] = [];
let id: string;

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

// Create a new window
function createWindow() {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	const win = new BrowserWindow({
		title: 'xplorer',
		frame: false,
		width: Math.floor(width * 0.8),
		height: Math.floor(height * 0.8),
		minWidth: 600,
		minHeight: 400,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			enableRemoteModule: true,
		},
	});

	win.loadFile(isDev ? './public/index.html' : 'src/public/index.html');
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
				? path.join(__dirname, 'icon/folder.png')
				: path.join(__dirname, 'icon/file.png'),
		});
	}
);
