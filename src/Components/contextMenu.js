const storage = require("electron-json-storage-sync");
const { execSync } = require('child_process');
const { updateTheme } = require("../Functions/Theme/theme");
const getPreview = require("../Functions/preview/preview");
const os = require("os");
const path = require("path");
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

const ContextMenuInner = (target, coorX, coorY, openDir) => {
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
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property" : "file property" }
        ]
    ]
    const BodyMenu = [
        [
            { "menu": "Layout Mode", "submenu": ["Grid View (Large)", "Grid View (Medium)", "Grid View (Small)", "Detail View"], "icon": "layout", "role": "layout" },
            { "menu": "Sort by", "submenu": ["A-Z", "Z-A", "Last Modified", "First Modified", "Size", "Type"], "icon": "sort", "role": "sort" },
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
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property" : "file property" }
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
                        else menu.innerHTML = `<img src = "${getPreview(item.icon, 'contextmenu', false)}" >${item?.menu?.trim() ?? item.trim()}`
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
                            if (item?.role) submenuItemElement.setAttribute("role", item?.role)
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

    document.querySelectorAll(".contextmenu-item").forEach(menu => {
        if (menu.dataset.submenu) {
            const submenu = document.getElementById(menu.dataset.submenu)
            const submenuItems = submenu.childNodes;
            let submenuCoorX = coorX + contextMenu.offsetWidth
            let submenuCoorY = coorY + menu.offsetTop

            if (coorX + contextMenu.offsetWidth > window.innerWidth) submenuCoorX = coorX - contextMenu.offsetWidth

            submenu.style.left = submenuCoorX + "px"
            submenu.style.top = submenuCoorY + "px"

            const clearLayoutModeClasses = element => {
                element.classList.remove("large-grid-view")
                element.classList.remove("medium-grid-view")
                element.classList.remove("small-grid-view")
                element.classList.remove("detail-view")
            }

            const clickSubmenuEvent = (e) => {
                if (e.target.getAttribute("role")) {
                    const files = document.querySelectorAll(".file")
                    const layout = storage.get('layout')?.data ?? {}
                    const sort = storage.get('layout')?.data ?? {}
                    const tabs = storage.get("tabs")?.data
                    const currentPath = tabs.tabs[tabs.focus].position
                    switch (e.target.innerText) {
                        case "Grid View (Large)":
                            files.forEach(file => {
                                clearLayoutModeClasses(file);
                                file.classList.add("large-grid-view")
                            })
                            layout[currentPath] = "l" // l = Large grid view
                            storage.set("layout", layout)
                            break;
                        case "Grid View (Medium)":
                            files.forEach(file => {
                                clearLayoutModeClasses(file);
                                file.classList.add("medium-grid-view")
                            })
                            layout[currentPath] = "m" // m = Medium grid view
                            storage.set("layout", layout)
                            break;
                        case "Grid View (Small)":
                            files.forEach(file => {
                                clearLayoutModeClasses(file);
                                file.classList.add("small-grid-view")
                            })
                            layout[currentPath] = "s" // s = Small grid view
                            storage.set("layout", layout)
                            break;
                        case "Detail View":
                            files.forEach(file => {
                                clearLayoutModeClasses(file);
                                file.classList.add("detail-view")
                            })
                            layout[currentPath] = "d" // d = Detail view
                            storage.set("layout", layout)
                            break;
                        case "A-Z":
                            sort[currentPath] = "A" // A = A - Z
                            storage.set("sort", sort)
                            openDir(currentPath)
                            break;
                        case "Z-A":
                            sort[currentPath] = "Z" // Z = Z - A
                            storage.set("sort", sort)
                            openDir(currentPath)
                            break;
                        case "Last Modified":
                            sort[currentPath] = "L" // L = Last Modified
                            storage.set("sort", sort)
                            openDir(currentPath)
                            break;
                        case "First Modified":
                            sort[currentPath] = "F" // F = First Modified
                            storage.set("sort", sort)
                            openDir(currentPath)
                            break;
                        case "Size":
                            sort[currentPath] = "S" // S = Size
                            storage.set("sort", sort)
                            openDir(currentPath)
                            break;
                        case "Type":
                            sort[currentPath] = "T" // T = Type
                            storage.set("sort", sort)
                            openDir(currentPath)
                            break;
                    }
                }
            }

            const onhover = () => {
                document.querySelectorAll(".contextmenu-submenu").forEach(submenu => submenu.style.display = "none")
                submenu.style.display = "block"
                submenu.addEventListener("click", clickSubmenuEvent)
            }
            const onstophover = () => {
                const trackMousePosition = e => {
                    if (!e.target === menu.parentElement) {
                        submenu.style.display = "none"
                        document.removeEventListener("mouseover", trackMousePosition)
                    }
                }
                document.addEventListener("mouseover", trackMousePosition)
            }

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
        let coorX = e.pageX;
        let coorY = e.pageY;

        const TOPBAR_ELEMENT = document.querySelector(".topbar");

        if (contextMenu.offsetHeight + coorY > window.innerHeight && coorY - contextMenu.offsetHeight > TOPBAR_ELEMENT.offsetHeight)
            coorY = coorY - (contextMenu.offsetHeight * .5) + "px";
        
        contextMenu.style.left = coorX + "px";
        contextMenu.style.top = coorY + "px";
        ContextMenuInner(e.target, coorX, coorY, openDir)

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
                        if (process.platform === "linux" && (filePath === "Home" || filePath === path.join(os.homedir(), "Home"))) execSync(`code ${os.homedir()}`)
                        else execSync(`code ${filePath}`)
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