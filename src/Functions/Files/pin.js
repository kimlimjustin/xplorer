const storage = require("electron-json-storage-sync");
const path = require("path");
const os = require("os");
const createSidebar = require("../../Components/sidebar");
/**
 * Pin file(s) into sidebar
 * @param {any} filePaths - array of file path you want to pin into sidebar
 * @returns {any}
 */
const Pin = (filePaths) => {
    const { listenOpen } = require("./open");
    const { data } = storage.get("sidebar");
    let favorites = data?.favorites ?? [
        { name: 'Home', path: 'xplorer://Home' },
        { name: 'Recent', path: 'xplorer://Recent' },
        { name: 'Desktop', path: `${path.join(os.homedir(), 'Desktop')}` },
        { name: 'Documents', path: `${path.join(os.homedir(), 'Documents')}` },
        { name: 'Downloads', path: `${path.join(os.homedir(), 'Downloads')}` },
        { name: 'Pictures', path: `${path.join(os.homedir(), 'Pictures')}` },
        { name: 'Music', path: `${path.join(os.homedir(), 'Music')}` },
        { name: 'Videos', path: `${path.join(os.homedir(), 'Videos')}` },
        { name: 'Trash', path: 'xplorer://Trash' }
    ]
    for (const filePath of filePaths) {
        if (favorites.filter(favorite => favorite.path === filePath).length) {
            favorites = favorites.filter(favorite => favorite.path !== filePath)
        } else {
            favorites.push({ name: path.basename(filePath), path: filePath })
        }
    }
    storage.set('sidebar', { favorites });
    createSidebar()
}

module.exports = Pin