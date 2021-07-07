const prompt = require('electron-prompt');
const storage = require("electron-json-storage-sync");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { dialog } = require('@electron/remote');
const { ErrorLog } = require('../Logs/log');
/**
 * Function to create popup window
 * @param {string} type - is it a file or folder
 * @returns {any}
 */
const NewFile = (type) => {
    switch (type) {
        case "new file":
            prompt({ title: 'New File', label: 'File Name:', inputAttrs: { type: 'text', required: true }, type: 'input' })
                .then((r) => {
                    if (r) {
                        const tabs = storage.get('tabs')?.data
                        const focusingPath = tabs.tabs[String(tabs.focus)].position === "Home" || tabs.tabs[String(tabs.focus)].position === path.join(os.homedir(), 'Home') ? os.homedir() : tabs.tabs[String(tabs.focus)].position
                        if (fs.existsSync(path.join(focusingPath, r))) {
                            dialog.showMessageBoxSync({ message: "A file with that name already exists.", type: "error" })
                        }
                        else {
                            for (let i = 1; i < r.split("/").length; i++) {
                                if (!fs.existsSync(path.join(focusingPath, r.split("/").splice(0, i).join("/")))) {
                                    fs.mkdirSync(path.join(focusingPath, r.split("/").splice(0, i).join("/")))
                                }
                            }
                            fs.writeFile(path.join(focusingPath, r), "", err => {
                                if (err) {
                                    dialog.showMessageBoxSync({ message: "Something went wrong, please try again or open an issue on GitHub.", type: "error" })
                                    ErrorLog(err)
                                }
                            })
                        }
                    }
                })
                .catch(console.error);
            break;
        case "new folder":
            prompt({ title: 'New Folder', label: 'Folder Name:', inputAttrs: { type: 'text', required: true }, type: 'input' })
                .then((r) => {
                    if (r) {
                        const tabs = storage.get('tabs')?.data
                        const focusingPath = tabs.tabs[String(tabs.focus)].position === "Home" || tabs.tabs[String(tabs.focus)].position === path.join(os.homedir(), 'Home') ? os.homedir() : tabs.tabs[String(tabs.focus)].position
                        if (fs.existsSync(path.join(focusingPath, r))) {
                            dialog.showMessageBoxSync({ message: "A folder with that name already exists.", type: "error" })
                        }
                        else {
                            for (let i = 1; i < r.split("/").length; i++) {
                                if (!fs.existsSync(path.join(focusingPath, r.split("/").splice(0, i).join("/")))) {
                                    fs.mkdirSync(path.join(focusingPath, r.split("/").splice(0, i).join("/")))
                                }
                            }
                            fs.mkdir(path.join(focusingPath, r), err => {
                                if (err) {
                                    dialog.showMessageBoxSync({ message: "Something went wrong, please try again or open an issue on GitHub.", type: "error" })
                                    ErrorLog(err)
                                }
                            })
                        }
                    }
                })
                .catch(console.error);
            break;
    }
}

module.exports = NewFile