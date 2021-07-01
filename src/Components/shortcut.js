const copyLocation = require("../Functions/Files/location");
const { getSelected } = require("../Functions/Files/select")

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
      if (e.key === "Enter" && selectedFilePath) {
         const { openDir, openFileWithDefaultApp } = require("../Functions/Files/open");
         if (isDir) {
            openDir(selectedFilePath)
         } else {
            openFileWithDefaultApp(selectedFilePath)
         }
      }
      // Copy location path (Alt + Shift + C)
      if (e.key === "C" && e.altKey && e.shiftKey) {
         copyLocation(getSelected()[0])
      }
   })
}

module.exports = { Shortcut, selectedAll, changeSelectedStatus, getSelectedStatus }