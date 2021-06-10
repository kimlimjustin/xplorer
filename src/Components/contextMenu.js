const storage = require("electron-json-storage-sync");
const { execSync } = require('child_process');
let vscodeInstalled = false
try {
    execSync("code --version")
    vscodeInstalled = true
} catch (_) { }

let contextMenu = document.querySelector(".contextmenu");
document.addEventListener("DOMContentLoaded", () => contextMenu = document.querySelector(".contextmenu"))

const ContextMenuInner = (element, target) => {
    if (target.classList.contains("home-section")) target = document.getElementById("main") // If context menu target is on home-section, use main element as target instead.
    while (!target.dataset.path) {
        target = target.parentNode
    }
    // Reset context menu contents
    contextMenu.innerHTML = ""
    const FileMenu = [
        [
            { "menu": "Open", "role": "open", "shortcut": "Enter" },
            { "menu": "Open in new tab", "visible": target?.dataset?.isdir === 'true', "role": "openInNewTab" },
            { "menu": "Open in terminal", "visible": target?.dataset?.isdir === "true", "role": "reveal", "shortcut": "Alt+T" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter" },
            { "menu": "Preview", "visible": target?.dataset?.isdir !== "false", "shortcut": "Ctrl+P" }
        ],
        [
            { "menu": "Cut", "shortcut": "Ctrl+X" },
            { "menu": "Copy", "shortcut": "Ctrl+C" },
            { "menu": "Create Shortcut", "shortcut": "Alt+S" },
        ],
        [
            { "menu": "Rename", "shortcut": "f2" },
            { "menu": "Delete", "shortcut": "Del" },
            { "menu": "Pin to Sidebar", "shortcut": "Alt+P" }
        ],
        [
            { "menu": "Properties", "shortcut": "Ctrl+P" }
        ]
    ]
    const BodyMenu = [
        [
            { "menu": "Layout Mode" },
            { "menu": "Sort by" },
            { "menu": "Refresh", "role": "refresh", "shortcut": "F5" }
        ],
        [
            { "menu": "Paste", "shortcut": "Ctrl+V" }
        ],
        [
            { "menu": "Open in terminal", "role": "reveal", "shortcut": "Alt+T" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter" },
            { "menu": "New" }
        ],
        [
            { "menu": "Pin to Sidebar", "shortcut": "Alt+P" },
            { "menu": "Properties", "shortcut": "Ctrl+P" }
        ]
    ]
    const MenuToElements = menu => {
        menu.forEach((section, index) => {
            section.forEach(item => {
                if (item.visible || item.visible === undefined) {
                    const menu = document.createElement('span')
                    menu.classList.add("contextmenu-item");
                    if (item.shortcut) menu.innerHTML = `${item?.menu || item}<span class="contextmenu-item-shortcut">${item.shortcut}</span>`
                    else menu.innerHTML = item?.menu || item
                    menu.setAttribute("role", item?.role)
                    contextMenu.appendChild(menu)
                }
            })
            if (index !== menu.length - 1) contextMenu.innerHTML += `<hr />`
        })
    }
    if (target === document.getElementById("main")) MenuToElements(BodyMenu)
    else if (target?.dataset?.path) MenuToElements(FileMenu)
}

const ContextMenu = (element, openFileWithDefaultApp, openDir) => {
    // Escape circular dependency
    if (!openFileWithDefaultApp) openFileWithDefaultApp = require('../Functions/Files/open').openFileWithDefaultApp
    if (!openDir) openDir = require("../Functions/Files/open").openDir

    element.addEventListener("contextmenu", e => {
        // Disable context menu if current path is home and on windows
        if (window.platform === "win32" && (!document.getElementById("main").dataset?.path || document.getElementById("main").dataset?.path === "Home")) return;
        ContextMenuInner(element, e.target)
        contextMenu.style.left = e.pageX + "px";
        contextMenu.style.top = e.pageY + "px";

        const TOPBAR_ELEMENT = document.querySelector(".topbar");

        if (contextMenu.offsetWidth + e.pageX > window.innerWidth) contextMenu.style.left = e.pageX - contextMenu.offsetWidth + "px";
        if (contextMenu.offsetHeight + e.pageY > window.innerHeight && e.pageY - contextMenu.offsetHeight > TOPBAR_ELEMENT.offsetHeight)
            contextMenu.style.top = e.pageY - contextMenu.offsetHeight + "px";

        contextMenu.querySelectorAll("span").forEach(menu => {
            menu.addEventListener("click", () => {
                let target = e.target;
                while (!target.dataset.path) {
                    target = target.parentNode
                }
                const filePath = unescape(target.dataset.path)
                switch (menu.getAttribute("role")) {
                    case "open":
                    case "openInNewTab":
                        if (menu.getAttribute("role") === "openInNewTab") {
                            const { createNewTab } = require('./tab');
                            createNewTab(filePath)
                        }
                        if (target.dataset.isdir !== 'true') {
                            let recents = storage.get('recent')?.data;
                            openFileWithDefaultApp(filePath)

                            // Push file into recent files
                            if (recents) {
                                if (recents.indexOf(filePath) !== -1) {
                                    recents.push(recents.splice(recents.indexOf(filePath), 1)[0]);
                                    storage.set('recent', recents)
                                } else {
                                    storage.set('recent', [...recents, filePath])
                                }
                            }
                            else storage.set('recent', [filePath])
                        } else {
                            openDir(filePath)
                        }
                        break;
                    case "reveal":
                        if (process.platform === "win32") {
                            execSync(`${filePath.split("\\")[0]} && cd ${filePath} && start cmd`)
                        } else if (process.platform === "linux") {
                            execSync(`gnome-terminal --working-directory="${filePath}"`)
                        } else {
                            execSync(`open -a Terminal ${filePath}`)
                        }
                        break;
                    case "code":
                        execSync(`code ${filePath}`)
                        break;
                    case "refresh":
                        const { reload } = require("./windowManager");
                        reload()
                        break;
                }
            })
        })


        const exitContextMenu = () => {
            contextMenu.style.left = "-100vw";
            contextMenu.style.top = "-100vh";
            document.body.removeEventListener("click", exitContextMenu)
        }
        document.body.addEventListener("click", exitContextMenu)
    })
}

const createContextMenus = (elements) => {
    elements.forEach(element => ContextMenu(element))
}

module.exports = { ContextMenu, createContextMenus }