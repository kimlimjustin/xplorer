const storage = require('electron-json-storage-sync')
const Translate = require('../../Components/multilingual')

const changePosition = (newPath) => {
    document.querySelector(".path-navigator").value = newPath
    const tabs = storage.get('tabs')?.data
    tabs.tabs[String(tabs.focus)] = newPath
    document.getElementById(`tab${tabs.focus}`).querySelector("#tab-position").innerText = process.platform === "win32" && newPath.split("\\").filter(p => p !== "").length === 1 ? Translate(newPath.split("\\")[0]) : Translate(newPath.substring(newPath.replace(/\//g, "\\").lastIndexOf("\\") + 1))
    storage.set('tabs', tabs)
}

module.exports = changePosition