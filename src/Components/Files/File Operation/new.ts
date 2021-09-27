import prompt from "electron-prompt";
import storage from "electron-json-storage-sync";
import path from "path";
import fs from "fs";
import { dialog } from "@electron/remote";
import { ErrorLog, OperationLog } from "../../Functions/log";
import { detectDefaultTheme } from "../../Theme/theme";
import focusingPath from "../../Functions/focusingPath";
/**
 * Function to create popup window
 * @param {string} type - is it a file or folder
 * @returns {void}
 */
const NewFile = (type: string): void => {
    const themeCategory = storage.get("theme")?.data?.category ?? detectDefaultTheme();
    const customStylesheet = path.join(__dirname, `../../Patches/${themeCategory === "light"? "prompt-light.css": "prompt-dark.css"}`)
    switch (type) {
        case "new file":
            prompt({ title: 'New File', label: 'File Name:', inputAttrs: { type: 'text', required: true }, type: 'input', icon: path.join(__dirname,'../../../../icons/icon.png'), alwaysOnTop: true, customStylesheet })
                .then((r:any) => { //eslint-disable-line
                    if (r) {
                        if (fs.existsSync(path.join(focusingPath(), r))) {
                            dialog.showMessageBoxSync({ message: "A file with that name already exists.", type: "error" })
                        }
                        else {
                            for (let i = 1; i < r.split("/").length; i++) {
                                if (!fs.existsSync(path.join(focusingPath(), r.split("/").splice(0, i).join("/")))) {
                                    fs.mkdirSync(path.join(focusingPath(), r.split("/").splice(0, i).join("/")))
                                }
                            }
                            fs.writeFile(path.join(focusingPath(), r), "", err => {
                                if (err) {
                                    dialog.showMessageBoxSync({ message: "Something went wrong, please try again or open an issue on GitHub.", type: "error" })
                                    ErrorLog(err)
                                }
                            })
                            OperationLog('newfile', null, path.join(focusingPath(), r))
                        }
                    }
                })
                .catch(console.error);
            break;
        case "new folder":
            prompt({ title: 'New Folder', label: 'Folder Name:', inputAttrs: { type: 'text', required: true }, type: 'input', icon: path.join(__dirname,'../../../../icons/icon.png'), alwaysOnTop: true, customStylesheet })
                .then((r:any) => { //eslint-disable-line
                    if (r) {
                        if (fs.existsSync(path.join(focusingPath(), r))) {
                            dialog.showMessageBoxSync({ message: "A folder with that name already exists.", type: "error" })
                        }
                        else {
                            for (let i = 1; i < r.split("/").length; i++) {
                                if (!fs.existsSync(path.join(focusingPath(), r.split("/").splice(0, i).join("/")))) {
                                    fs.mkdirSync(path.join(focusingPath(), r.split("/").splice(0, i).join("/")))
                                }
                            }
                            fs.mkdir(path.join(focusingPath(), r), err => {
                                if (err) {
                                    dialog.showMessageBoxSync({ message: "Something went wrong, please try again or open an issue on GitHub.", type: "error" })
                                    ErrorLog(err)
                                }
                            })
                            OperationLog('newfolder', null, path.join(focusingPath(), r))
                        }
                    }
                })
                .catch(console.error);
            break;
    }
}

export default NewFile