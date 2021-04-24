const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

try {
   require('electron-reloader')(module)
} catch (_) { }

function createWindow() {
   const win = new BrowserWindow({
      transparent:true,
      frame: false,
      webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         enableRemoteModule: true
      }
   })

   win.loadFile('src/public/index.html')
   //win.removeMenu()
}

app.whenReady().then(() => {
   createWindow()

   app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
         createWindow()
      }
   })
})

app.on('window-all-closed', () => {
   if (process.platform !== 'darwin') {
      app.quit()
   }
})
