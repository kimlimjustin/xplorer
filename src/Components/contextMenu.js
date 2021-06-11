const storage = require("electron-json-storage-sync");
const { execSync } = require('child_process');
const { updateTheme } = require("../Functions/Theme/theme");
const getPreview = require("../Functions/preview/preview");
let vscodeInstalled = false
try {
    execSync("code --version")
    vscodeInstalled = true
} catch (_) { }

let contextMenu = document.querySelector(".contextmenu");
let contextMenuSubmenus = document.getElementById("contextmenu-submenus");
document.addEventListener("DOMContentLoaded", () => {
    contextMenu = document.querySelector(".contextmenu");
    contextMenuSubmenus = document.getElementById("contextmenu-submenus");
})

const ContextMenuInner = (element, target, coorX, coorY) => {
    if (target.classList.contains("home-section")) target = document.getElementById("main") // If context menu target is on home-section, use main element as target instead.
    while (!target.dataset.path) {
        target = target.parentNode
    }
    // Reset context menu contents
    contextMenu.innerHTML = ""
    contextMenuSubmenus.innerHTML = ""
    const FileMenu = [
        [
            { "menu": "Open", "role": "open", "shortcut": "Enter", "icon": "open" },
            { "menu": "Open in new tab", "visible": target?.dataset?.isdir === 'true', "role": "openInNewTab", "icon": "open in new tab" },
            { "menu": "Open in terminal", "visible": target?.dataset?.isdir === "true", "role": "reveal", "shortcut": "Alt+T", "icon": "terminal" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter", "icon": "vscode" },
            { "menu": "Preview", "visible": target?.dataset?.isdir !== "false", "shortcut": "Ctrl+P", "icon": "preview" }
        ],
        [
            { "menu": "Cut", "shortcut": "Ctrl+X", "icon": "cut" },
            { "menu": "Copy", "shortcut": "Ctrl+C", "icon": "copy" },
            { "menu": "Create Shortcut", "shortcut": "Alt+S", "icon": "shortcut" },
        ],
        [
            { "menu": "Rename", "shortcut": "f2", "icon": "rename" },
            { "menu": "Delete", "shortcut": "Del", "icon": "delete" },
            { "menu": "Pin to Sidebar", "shortcut": "Alt+P", "icon": "pin" }
        ],
        [
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property": "file property" }
        ]
    ]
    const BodyMenu = [
        [
            { "menu": "Layout Mode", "submenu": ["Grid View (Large)", "Grid View (Medium)", "Grid View (Small)", "Tiles View", "Detail Size"], "icon": "layout" },
            { "menu": "Sort by", "submenu": ["A-Z", "Z-A", "Last Modified", "First Modified", "Size", "Type"], "icon": "sort" },
            { "menu": "Refresh", "role": "refresh", "shortcut": "F5", "icon": "refresh" }
        ],
        [
            { "menu": "Paste", "shortcut": "Ctrl+V", "icon": "paste" }
        ],
        [
            { "menu": "Open in terminal", "role": "reveal", "shortcut": "Alt+T", "icon": "terminal" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter", "icon": "vscode" },
            { "menu": "New", "submenu": ["folder", "file"], "icon": "new" }
        ],
        [
            { "menu": "Pin to Sidebar", "shortcut": "Alt+P", "icon": "pin" },
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property": "file property" }
        ]
    ]
    const MenuToElements = menu => {
        menu.forEach((section, index) => {
            section.forEach(item => {
                if (item.visible || item.visible === undefined) {
                    const menu = document.createElement('span')
                    menu.classList.add("contextmenu-item");
                    if (item.icon) {
                        if (item.shortcut) menu.innerHTML = `<img src = "${getPreview(item.icon, 'contextmenu', false)}">${item?.menu.trim() ?? item.trim()}<span class="contextmenu-item-shortcut">${item.shortcut}</span>`
                        else menu.innerHTML = `<img src = "${getPreview(item.icon, 'contextmenu', false)}" >${ item?.menu?.trim() ?? item.trim() }`
                    } else {
                        if (item.shortcut) menu.innerHTML = `${item?.menu?.trim() || item.trim()}<span class="contextmenu-item-shortcut">${item.shortcut}</span>`
                        else menu.innerHTML = item?.menu?.trim() ?? item.trim()
                    }
                    menu.setAttribute("role", item?.role)
                    contextMenu.appendChild(menu)

                    const submenuId = Math.random().toString(36).substr(2, 10)

                    // Create submenu element for context menu
                    if (item.submenu) {
                        let submenu = document.createElement("div");
                        submenu.classList.add("contextmenu-submenu")

                        menu.dataset.submenu = submenuId
                        submenu.id = submenuId

                        contextMenuSubmenus.appendChild(submenu)
                        item.submenu.forEach(submenuItem => {
                            const submenuItemElement = document.createElement("span");
                            submenuItemElement.classList.add("contextmenu-item")
                            submenuItemElement.innerHTML = submenuItem
                            if (submenuItem.role) menu.setAttribute("role", submenuItem?.role)
                            submenu.appendChild(submenuItemElement)
                        })
                    }
                }
            })
            if (index !== menu.length - 1) contextMenu.innerHTML += `<hr />`
        })
    }
    if (target === document.getElementById("main")) MenuToElements(BodyMenu)
    else if (target?.dataset?.path) MenuToElements(FileMenu)

    updateTheme()
    const TOPBAR_ELEMENT = document.querySelector(".topbar");

    document.querySelectorAll(".contextmenu-item").forEach(menu => {
        if (menu.dataset.submenu) {
            const submenu = document.getElementById(menu.dataset.submenu)
            let submenuCoorX = coorX + contextMenu.offsetWidth
            let submenuCoorY = coorY + menu.offsetTop

            if (coorX + contextMenu.offsetWidth > window.innerWidth) submenuCoorX = coorX - contextMenu.offsetWidth
            if (contextMenu.offsetHeight + coorY > window.innerHeight && coorY - contextMenu.offsetHeight > TOPBAR_ELEMENT.offsetHeight)
                submenuCoorY = coorY - (contextMenu.offsetHeight * .5)

            submenu.style.left = submenuCoorX + "px"
            submenu.style.top = submenuCoorY + "px"

            const onhover = () => submenu.style.display = "block"
            const onstophover = () => submenu.style.display = "none";

            menu.addEventListener("mouseover", onhover)
            menu.addEventListener("mouseout", onstophover)
            menu.addEventListener("click", () => {
                onhover()
                menu.removeEventListener("mouseout", onstophover)
            })
        }
    })
}

const ContextMenu = (element, openFileWithDefaultApp, openDir) => {
    // Escape circular dependency
    if (!openFileWithDefaultApp) openFileWithDefaultApp = require('../Functions/Files/open').openFileWithDefaultApp
    if (!openDir) openDir = require("../Functions/Files/open").openDir

    element.addEventListener("contextmenu", e => {
        // Disable context menu if current path is home and on windows
        if (window.platform === "win32" && (!document.getElementById("main").dataset?.path || document.getElementById("main").dataset?.path === "Home")) return;
        ContextMenuInner(element, e.target, e.pageX, e.pageY)
        contextMenu.style.left = e.pageX + "px";
        contextMenu.style.top = e.pageY + "px";

        const TOPBAR_ELEMENT = document.querySelector(".topbar");

        if (contextMenu.offsetHeight + e.pageY > window.innerHeight && e.pageY - contextMenu.offsetHeight > TOPBAR_ELEMENT.offsetHeight)
            contextMenu.style.top = e.pageY - (contextMenu.offsetHeight * .5) + "px";

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


        const exitContextMenu = e => {
            if (!e.target.classList.contains("contextmenu-item")) {
                contextMenu.style.left = "-100vw";
                contextMenu.style.top = "-100vh";
                contextMenuSubmenus.innerHTML = ""
                document.body.removeEventListener("click", exitContextMenu)
            }
        }
        document.body.addEventListener("click", exitContextMenu)
    })
}

const createContextMenus = (elements) => {
    elements.forEach(element => ContextMenu(element))
}

module.exports = { ContextMenu, createContextMenus }