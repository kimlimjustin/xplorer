const storage = require('electron-json-storage-sync')

const changePosition = (newPath) => {
    document.querySelector(".path-navigator").value = newPath
    const tabs = storage.get('tabs')?.data
    tabs.tabs[String(tabs.focus)] = newPath
    document.getElementById(`tab${tabs.focus}`).querySelector("#tab-position").innerText = process.platform === "win32" && newPath.split("\\").filter(p => p !== "").length === 1 ? newPath.split("\\")[0] : newPath.substring(newPath.lastIndexOf("\\")+1)
    storage.set('tabs', tabs)
}

module.exports = changePosition