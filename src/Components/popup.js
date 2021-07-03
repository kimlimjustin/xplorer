const prompt = require('electron-prompt');
const storage = require("electron-json-storage-sync");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { dialog } = require('@electron/remote');
/**
 * Function to create popup window
 * @param {string} frameName - what type of popup you want to create?
 * @returns {any}
 */
const Popup = (frameName) => {
    if (frameName === "new file") {
        prompt({ title: 'New File', label: 'File Name:', inputAttrs: { type: 'text' }, type: 'input' })
            .then((r) => {
                if (r) {
                    const tabs = storage.get('tabs')?.data
                    const focusingPath = tabs.tabs[String(tabs.focus)].position === "Home" || tabs.tabs[String(tabs.focus)].position === path.join(os.homedir(), 'Home') ? os.homedir() : tabs.tabs[String(tabs.focus)].position
                    if (fs.existsSync(path.join(focusingPath, r))) {
                        dialog.showMessageBoxSync({ message: "A file with that name already exists.", type: "error" })
                    }
                    else {
                        fs.writeFile(path.join(focusingPath, r), "", err => {
                            if (err) dialog.showMessageBoxSync({ message: "Something went wrong, please try again or open an issue on GitHub.", type: "error" })
                        })
                    }
                }
            })
            .catch(console.error);

    }
}

module.exports = Popup