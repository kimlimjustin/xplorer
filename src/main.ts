const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')
const storage = require('electron-json-storage-sync')
require('@electron/remote/main').initialize()


try {
   require('electron-reloader')(module)
} catch (_) { }


console.log(process.argv)

let id:string;
ipcMain.on('GUID', (e:any, arg:any) => {
   id = arg;
})

// Create a new window
function createWindow() {
   const win = new BrowserWindow({
      title: "xplorer",
      frame: false,
      minWidth: 600,
      minHeight: 400,
      webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         enableRemoteModule: true
      }
   })

   win.loadFile('../src/public/index.html')
   win.webContents.on('new-window', (e:any, url:string) => {
      e.preventDefault()
      require('electron').shell.openExternal(url);
   })
}

app.allowRendererProcessReuse = false

app.whenReady().then(() => {
   createWindow()

   app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
         createWindow()
      }
   })
})

app.on('window-all-closed', () => {
   storage.remove(`tabs-${id}`)
   if (process.platform !== 'darwin') {
      app.quit()
   }
})
ipcMain.on('ondragstart', (event:any, filePath:string, options:any) => {
   event.sender.startDrag({
      file: filePath,
      icon: options.isDir ? path.join(__dirname, "icon/folder.png") : path.join(__dirname, "icon/file.png")
   })
})