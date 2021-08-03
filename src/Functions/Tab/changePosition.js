const storage = require('electron-json-storage-sync')
const Translate = require('../../Components/multilingual')
const { changeSelectedStatus } = require('../../Components/shortcut')
const path = require("path");

/**
 * Change current tab position
 * @param {string} newPath - the new position you want to open
 * @returns {any}
 */
const changePosition = (newPath) => {
    document.querySelector(".path-navigator").value = newPath
    document.getElementById("workspace").dataset.path = escape(newPath)

    const tabs = storage.get('tabs')?.data
    const _focusingTab = tabs.tabs[String(tabs.focus)]
    tabs.tabs[String(tabs.focus)].position = newPath

    if (newPath !== _focusingTab.history[_focusingTab.history.length - 1]) {

        if (_focusingTab.currentIndex + 1 === _focusingTab.history.length) {
            tabs.tabs[String(tabs.focus)].currentIndex += 1
            tabs.tabs[String(tabs.focus)].history.push(newPath)
        } else if (_focusingTab.history[_focusingTab.currentIndex + 1] === newPath) {
            tabs.tabs[String(tabs.focus)].currentIndex += 1
        } else {
            if (_focusingTab.history[_focusingTab.currentIndex] !== newPath) {
                tabs.tabs[String(tabs.focus)].history = tabs.tabs[String(tabs.focus)].history.slice(0, tabs.tabs[String(tabs.focus)].currentIndex - 1)
                tabs.tabs[String(tabs.focus)].history.push(newPath)
                tabs.tabs[String(tabs.focus)].currentIndex -= 1
            }
        }
    } else if (_focusingTab.history[_focusingTab.currentIndex + 1] === newPath) {
        tabs.tabs[String(tabs.focus)].currentIndex += 1
    } else {
        tabs.tabs[String(tabs.focus)].history.slice(0, tabs.tabs[String(tabs.focus)].currentIndex - 1)
        tabs.tabs[String(tabs.focus)].currentIndex += 1
    }

    document.getElementById(`tab${tabs.focus}`).querySelector("#tab-position").innerText = Translate(path.basename(newPath))
    storage.set('tabs', tabs)
    changeSelectedStatus()
    return
}

module.exports = changePosition