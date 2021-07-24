const copyLocation = require("../Functions/Files/location");
const { getSelected } = require("../Functions/Files/select");
const { execSync, exec } = require('child_process');
const NewFile = require("../Functions/Files/new");
const Rename = require("../Functions/Files/rename");
const { updateTheme } = require("../Functions/Theme/theme");
const storage = require("electron-json-storage-sync");
const { toggleHideHiddenFilesValue, getHideHiddenFilesValue } = require("../Functions/Files/toggleHiddenFiles")
const path = require('path');
const os = require("os");
const Copy = require("../Functions/Files/copy");
const Cut = require("../Functions/Files/cut");
const Paste = require("../Functions/Files/paste");
const Pin = require("../Functions/Files/pin");
const { Trash, PermanentDelete } = require("../Functions/Files/trash");
let vscodeInstalled = false
try {
   execSync("code --version")
   vscodeInstalled = true
} catch (_) { }

let selectedAll = true;

/**
 * Get if currently selecting all files
 * @returns {boolean} currently selecting all files
 */
const getSelectedStatus = () => selectedAll
/**
 * Change selected all status
 * @returns {any}
 */
const changeSelectedStatus = () => {
   selectedAll = false
}

/**
 * Shortcut initializer function for Xplorer
 * @returns {any}
 */
const Shortcut = () => {
   const { reload, minimize, maximize } = require("./windowManager");
   const { createNewTab, goBack, goForward } = require("./tab");
   const ShortcutHandler = e => {
      e.preventDefault()
      const selectedFilePath = unescape(getSelected()?.[0]?.dataset?.path)
      const isDir = getSelected()?.[0]?.dataset.isdir === "true"
      const tabs = storage.get('tabs')?.data
      const focusingPath = tabs.tabs[tabs.focus].position === "Home" || tabs.tabs[tabs.focus].position === path.join(os.homedir(), "Home") ? os.homedir() : tabs.tabs[tabs.focus].position
      // Select all shortcut (Ctrl + A)
      if (e.key === "a" && e.ctrlKey) {
         selectedAll = !selectedAll
         if (selectedAll) {
            document.querySelectorAll(".file").forEach(element => element.classList.add("selected"))
         } else document.querySelectorAll(".file").forEach(element => element.classList.remove("selected"))
      }
      // New file shortcut (Alt + N)
      else if (e.key === "n" && e.altKey && !e.shiftKey) {
         NewFile("new file")
      }
      // New folder shortcut (Shift + N)
      else if (e.key === "N" && !e.altKey && e.shiftKey) {
         NewFile("new folder")
      }
      else if (e.key === "F2") {
         if (getSelected()[0]) Rename(getSelected()[0].dataset.path)
      }
      // Open file shorcut (Enter)
      else if (e.key === "Enter") {
         for (const selected of getSelected()) {
            // Open file in vscode (Shift + Enter)
            if (e.shiftKey && vscodeInstalled) {
               const targetPath = unescape(selected.dataset.path) === "undefined" ? focusingPath : unescape(selected.dataset.path)
               exec(`code "${targetPath.replaceAll('"', "\\\"")}"`)
            } else {
               const { openDir, openFileWithDefaultApp } = require("../Functions/Files/open");
               if (isDir) {
                  openDir(selectedFilePath)
               } else {
                  openFileWithDefaultApp(selectedFilePath)
               }
            }
         }
      }
      // Copy location path (Alt + Shift + C)
      else if (e.key === "C" && e.altKey && e.shiftKey) {
         copyLocation(getSelected()[0])
      }
      // Refresh page shortcut (Ctrl+R, F5)
      else if ((e.ctrlKey && e.key === "r") || e.key === "F5") reload()
      // Minimze window shortcut (Alt+Arrow Down, F10)
      else if ((e.altKey && e.key === "ArrowDown") || e.key === "F10") minimize()
      // Maximize window shortcut (Alt+Arrow Up, F11)
      else if ((e.altKey && e.key === "ArrowUp") || e.key === "F11") maximize()
      // New tab shortcut (Ctrl+T)
      else if (e.ctrlKey && e.key === "t") {
         createNewTab()
         updateTheme()
      }
      // Exit tab shortcut (Ctrl+E)
      else if (e.ctrlKey && e.key === "e") {
         const tabs = storage.get('tabs')?.data
         if (document.querySelectorAll(".tab").length === 1) {
            const electronWindow = remote.BrowserWindow.getFocusedWindow()
            electronWindow.close()
         } else {
            const tab = document.getElementById(`tab${tabs.focus}`)
            tab.parentElement.removeChild(tab)
            tabs.focusHistory = tabs.focusHistory.filter(tabIndex => String(tabIndex) !== tabs.focus)
            tabs.focus = String(tabs.focusHistory[tabs.focusHistory.length - 1])
            delete tabs.tabs[tabs.focus]
            storage.set("tabs", tabs)
         }
      }
      // Previous tab shortcut (Alt+Arrow Left)
      else if (e.altKey && e.key === "ArrowLeft") {
         goBack()
      }
      // Next tab shortcut (Alt+Arrow Right)
      else if (e.altKey && e.key === "ArrowRight") {
         goForward()
      }
      // Toggle hidden files shortcut (Ctrl+H)
      else if (e.ctrlKey && e.key === "h") {
         const userPreference = storage.get('preference')?.data // Read user preference
         toggleHideHiddenFilesValue()
         const hideHiddenFiles = getHideHiddenFilesValue()
         storage.set('preference', Object.assign({}, userPreference, { hideHiddenFiles }))
         document.getElementById("main").dataset.hideHiddenFiles = hideHiddenFiles
         document.getElementById("show-hidden-files").checked = !hideHiddenFiles
      }
      // Open in terminal shortcut (Alt + T)
      else if (e.altKey && e.key === "t") {
         if (process.platform === "win32") {
            execSync(`${filePath.split("\\")[0]} && cd ${selectedFilePath === "undefined" ? focusingPath : selectedFilePath} && start cmd`)
         } else if (process.platform === "linux") {
            console.log(selectedFilePath === "undefined" ? focusingPath : selectedFilePath)
            execSync(`gnome-terminal --working-directory="${selectedFilePath === "undefined" ? focusingPath : selectedFilePath}"`)
         } else {
            execSync(`open -a Terminal ${selectedFilePath === "undefined" ? focusingPath : selectedFilePath}`)
         }
      }
      // Copy file shortcut (Ctrl+C)
      else if (e.ctrlKey && e.key === "c") {
         const filePaths = []
         for (const element of getSelected()) {
            filePaths.push(unescape(element.dataset.path))
         }
         Copy(filePaths)
      }
      // Cut file shortcut (Ctrl+X)
      else if (e.ctrlKey && e.key === "x") {
         const filePaths = []
         for (const element of getSelected()) {
            filePaths.push(unescape(element.dataset.path))
         }
         Cut(filePaths)
      }
      // Paste file shortcut (Ctrl+V)
      else if (e.ctrlKey && e.key === "v") {
         Paste(focusingPath)
      }
      // Pin to sidebar shortcut (Alt+P)
      else if (e.altKey && e.key === "p") {
         let filePaths = []
         for (const element of getSelected()) {
            filePaths.push(unescape(element.dataset.path))
         }
         if (!filePaths.length) filePaths = [focusingPath]
         Pin(filePaths)
      }
      else if (e.key === "Delete") {
         if (e.shiftKey) {
            let filePaths = []
            for (const element of getSelected()) {
               filePaths.push(unescape(element.dataset.path))
            }
            PermanentDelete(filePaths)
         } else {
            let filePaths = []
            for (const element of getSelected()) {
               filePaths.push(unescape(element.dataset.path))
            }
            Trash(filePaths)
         }
      }

   }
   document.addEventListener("keyup", ShortcutHandler)
   window.addEventListener("beforeunload", () => {
      document.removeEventListener("keyup", ShortcutHandler, false)
   })
}

module.exports = { Shortcut, selectedAll, changeSelectedStatus, getSelectedStatus }