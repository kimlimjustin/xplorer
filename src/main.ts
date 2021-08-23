import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'path';
import storage from 'electron-json-storage-sync';
import * as remoteInit from '@electron/remote/main';
import isDev from 'electron-is-dev';
if (isDev) {
    try {
        const electronReloader = require('electron-reloader');
        electronReloader(module);
    } catch (_) {}
}
remoteInit.initialize();

/*try {
    electronReloader(module);
    // eslint-disable-next-line no-empty
} catch (_) {}*/

console.log(process.argv);

let id: string;
ipcMain.on('GUID', (_, arg: string) => {
    id = arg;
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

    win.loadFile('src/public/index.html');
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
