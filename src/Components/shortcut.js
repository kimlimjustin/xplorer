const copyLocation = require("../Functions/Files/location");
const { getSelected } = require("../Functions/Files/select");
const { execSync, exec } = require('child_process');
const Popup = require("./popup");
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
   document.addEventListener("keydown", e => {
      const selectedFilePath = unescape(getSelected()?.[0]?.dataset?.path)
      const isDir = getSelected()?.[0]?.dataset.isdir === "true"
      // Select all shortcut (Ctrl + A)
      if (e.key === "a" && e.ctrlKey) {
         selectedAll = !selectedAll
         if (selectedAll) {
            document.querySelectorAll(".file").forEach(element => element.classList.add("selected"))
         } else document.querySelectorAll(".file").forEach(element => element.classList.remove("selected"))
      }
      // Open file shorcut (Enter)
      if (e.key === "Enter" && selectedFilePath) {
         // Open file in vscode (Shift + Enter)
         if (e.shiftKey && vscodeInstalled) {
            exec(`code "${selectedFilePath.replaceAll('"', "\\\"")}"`)
         } else {
            const { openDir, openFileWithDefaultApp } = require("../Functions/Files/open");
            if (isDir) {
               openDir(selectedFilePath)
            } else {
               openFileWithDefaultApp(selectedFilePath)
            }
         }
      }
      // New file shortcut (Alt + N)
      if (e.key === "n" && e.altKey && !e.shiftKey) {
         Popup("new file")
      }
      // Copy location path (Alt + Shift + C)
      if (e.key === "C" && e.altKey && e.shiftKey) {
         copyLocation(getSelected()[0])
      }
   })
}

module.exports = { Shortcut, selectedAll, changeSelectedStatus, getSelectedStatus }