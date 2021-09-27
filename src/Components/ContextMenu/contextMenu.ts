import storage from "electron-json-storage-sync";
import { execSync, exec } from 'child_process';
import { updateTheme } from "../Theme/theme";
import fileIcon from "../Files/File Icon/fileIcon";
import os from "os";
import path from "path";
import copyLocation from "../Files/File Operation/location";
import NewFile from "../Files/File Operation/new";
import Rename from "../Files/File Operation/rename";
import Copy from "../Files/File Operation/copy"; 
import Paste from "../Files/File Operation/paste";
import Cut from "../Files/File Operation/cut";
import { getSelected } from "../Files/File Operation/select";
import Pin from "../Files/File Operation/pin";
import { Restore, Trash, PermanentDelete } from "../Files/File Operation/trash";
import { FILE_TYPES_AVAILABLE_FOR_PREVIEW, Preview } from "../Files/File Preview/preview";
import windowGUID from "../Constants/windowGUID";
import focusingPath from "../Functions/focusingPath";
import Properties from "../Properties/properties";
import Undo from "../Files/File Operation/undo";
import Redo from "../Files/File Operation/redo";
let vscodeInstalled = false
try {
    execSync("code --version")
    vscodeInstalled = true
} catch (err) {console.log(`INFO: vscode not installed`,err)}

let contextMenu = document.querySelector(".contextmenu") as HTMLElement;
let contextMenuSubmenus = document.getElementById("contextmenu-submenus");
document.addEventListener("DOMContentLoaded", () => {
    contextMenu = document.querySelector(".contextmenu") as HTMLElement;
    contextMenuSubmenus = document.getElementById("contextmenu-submenus");
})

interface Favorites {
	name: string;
	path: string;
}

interface MenuItem{
    menu: string;
    role?: string;
    visible?: boolean;
    icon?: string;
    shortcut?: string;
    submenu?: {
        shortcut?: string;
        name?: string;
    }[];
}
type Menu = MenuItem[][];

type openFileWithDefaultApp = (file: string) => void;
type open = (dir:string) => void;

const ContextMenuInner = (target: HTMLElement, coorX:number, coorY:number, open:open) => {
    if (target.classList.contains("home-section")) target = document.getElementById("workspace") // If context menu target is on home-section, use main element as target instead.
    while (!target.dataset.path) {
        target = target.parentNode as HTMLElement
    }
    // Reset context menu contents
    contextMenu.innerHTML = ""
    contextMenuSubmenus.innerHTML = ""
    const favorites:Favorites[] = storage.get("sidebar")?.data?.favorites
    const isPinned = !!favorites?.filter(favorite => favorite.path === target.dataset.path).length ?? false
    const isTrash = !!target.dataset.isTrash
    const SidebarMenu = [
        [
            { "menu": "Open", "role": "open", "icon": "open" },
            { "menu": "Open in new tab", "visible": target?.dataset?.isdir === 'true', "icon": "open in new tab", "role": "openInNewTab" },
            { "menu": "Preview", "visible": FILE_TYPES_AVAILABLE_FOR_PREVIEW.indexOf(path.extname(target?.dataset?.path)) !== -1, "shortcut": "Ctrl+O", "icon": "preview", "role": "preview" }
        ],
        [
            { "menu": "Unpin from Sidebar", "icon": "pin", "role": "pin" }
        ]
    ]
    const SidebarDriveMenu = [
        [
            { "menu": "Open", "role": "open", "icon": "open" },
            { "menu": "Open in new tab", "visible": target?.dataset?.isdir === 'true', "icon": "open in new tab", "role": "openInNewTab" },
        ],
    ]
    const FileMenu = [
        [
            { "menu": "Open", "role": "open", "shortcut": "Enter", "icon": "open" },
            { "menu": "Open in new tab", "visible": target?.dataset?.isdir === 'true', "role": "openInNewTab", "icon": "open in new tab" },
            { "menu": "Open in terminal", "visible": target?.dataset?.isdir === "true", "role": "reveal", "shortcut": "Alt+T", "icon": "terminal" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter", "icon": "vscode" },
            { "menu": "Preview", "visible": FILE_TYPES_AVAILABLE_FOR_PREVIEW.indexOf(path.extname(target?.dataset?.path)) !== -1, "shortcut": "Ctrl+O", "icon": "preview", "role": "preview" }
        ],
        [
            { "menu": "Cut", "shortcut": "Ctrl+X", "icon": "cut", "role": "cut" },
            { "menu": "Copy", "shortcut": "Ctrl+C", "icon": "copy", "role": "copy" },
            { "menu": "Copy Location Path", "shortcut": "Alt+Shift+C", "icon": "location", "role": "location" },
        ],
        [
            { "menu": "Rename", "shortcut": "F2", "icon": "rename", "role": "rename" },
            { "menu": "Delete", "shortcut": "Del", "icon": "delete", "role": "delete" },
            { "menu": isPinned ? "Unpin from Sidebar" : "Pin to Sidebar", "shortcut": "Alt+P", "icon": "pin", "role": "pin" }
        ],
        [
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property" : "file property", "role": "properties" }
        ]
    ]
    const TrashMenu = [
        [
            { "menu": "Open", "role": "open", "shortcut": "Enter", "icon": "open" },
            { "menu": "Open in new tab", "visible": target?.dataset?.isdir === 'true', "role": "openInNewTab", "icon": "open in new tab" },
            { "menu": "Open in terminal", "visible": target?.dataset?.isdir === "true", "role": "reveal", "shortcut": "Alt+T", "icon": "terminal" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter", "icon": "vscode" },
            { "menu": "Preview", "visible": target?.dataset?.isdir !== "false", "shortcut": "Ctrl+O", "icon": "preview" }
        ],
        [
            { "menu": "Cut", "shortcut": "Ctrl+X", "icon": "cut", "role": "cut" },
            { "menu": "Copy", "shortcut": "Ctrl+C", "icon": "copy", "role": "copy" },
            { "menu": "Copy Location Path", "shortcut": "Alt+Shift+C", "icon": "location", "role": "location" },
        ],
        [
            { "menu": "Rename", "shortcut": "F2", "icon": "rename", "role": "rename" },
            { "menu": "Restore", "icon": "delete", "role": "restore" },
            { "menu": "Permanent Delete", "shortcut": "Shift+Del", "icon": "delete", "role": "unlink" },
            { "menu": isPinned ? "Unpin from Sidebar" : "Pin to Sidebar", "shortcut": "Alt+P", "icon": "pin", "role": "pin" }
        ],
        [
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property" : "file property" }
        ]
    ]
    const BodyMenu = [
        [
            { "menu": "Layout Mode", "submenu": [{"name":"Grid View (Large)"}, {"name":"Grid View (Medium)"}, {"name":"Grid View (Small)"}, {"name":"Detail View"}], "icon": "layout", "role": "layout" },
            { "menu": "Sort by", "submenu": [{"name":"A-Z"}, {"name":"Z-A"}, {"name":"Last Modified"}, {"name":"First Modified"}, {"name":"Size"}, {"name":"Type"}], "icon": "sort", "role": "sort" },
            { "menu": "Refresh", "role": "refresh", "shortcut": "F5", "icon": "refresh" }
        ],
        [
            { "menu": "Paste", "shortcut": "Ctrl+V", "icon": "paste", "role": "paste" },
            { "menu": "Undo Action", "shortcut": "Ctrl+Z", "icon": "undo", "role": "undo" },
            { "menu": "Redo Action", "shortcut": "Ctrl+Y", "icon": "redo", "role": "redo" },
            { "menu": "Copy Location Path", "shortcut": "Alt+Shift+C", "icon": "location", "role": "location" },
        ],
        [
            { "menu": "Open in terminal", "role": "reveal", "shortcut": "Alt+T", "icon": "terminal" },
            { "menu": "Open in vscode", "role": "code", "visible": vscodeInstalled, "shortcut": "Shift+Enter", "icon": "vscode" },
            { "menu": "New", "submenu": [{ "name": "Folder", "shortcut": "Shift+N" }, { "name": "File", "shortcut": "Alt+N" }], "icon": "new", "role": "new" }
        ],
        [
            { "menu": isPinned ? "Unpin from Sidebar" : "Pin to Sidebar", "shortcut": "Alt+P", "icon": "pin", "role": "pin" },
            { "menu": "Properties", "shortcut": "Ctrl+P", "icon": target?.dataset?.isdir ? "folder property" : "file property", "role": "properties" }
        ]
    ]
    const MultipleSelectedMenu = [
        [
            { "menu": "Open in new tab", 'role': "openMultipleTabs", "icon": "open in new tab" },
            { "menu": "Open in vscode", "role": "codes", "shortcut": "Shift+Enter", "icon": "vscode" }
        ],
        [
            { "menu": "Cut", "shortcut": "Ctrl+X", "icon": "cut", "role": "cuts" },
            { "menu": "Copy", "shortcut": "Ctrl+C", "icon": "copy", "role": "copies" },
            { "menu": "Delete", "shortcut": "Del", "icon": "delete", "role": "deletes" },
        ],
        [
            { "menu": "Pin to Sidebar", "shortcut": "Alt+P", "icon": "pin", "role": "pins" }
        ]
    ]
    const MenuToElements = (menu:Menu) => {
        menu.forEach((section, index) => {
            section.forEach(item => {
                if (item.visible || item.visible === undefined) {
                    const menu = document.createElement('span')
                    menu.classList.add("contextmenu-item");
                    if (item.icon) {
                        if (item.shortcut) menu.innerHTML = `<img src = "${fileIcon(item.icon, 'contextmenu', false)}">${item?.menu.trim()}<span class="contextmenu-item-shortcut">${item.shortcut}</span>`
                        else menu.innerHTML = `<img src = "${fileIcon(item.icon, 'contextmenu', false)}" >${item?.menu?.trim()}`
                    } else {
                        if (item.shortcut) menu.innerHTML = `${item?.menu?.trim()}<span class="contextmenu-item-shortcut">${item.shortcut}</span>`
                        else menu.innerHTML = item?.menu?.trim()
                    }
                    menu.setAttribute("role", item?.role)
                    contextMenu.appendChild(menu)

                    const submenuId = Math.random().toString(36).substr(2, 10)

                    // Create submenu element for context menu
                    if (item.submenu) {
                        const submenu = document.createElement("div");
                        submenu.classList.add("contextmenu-submenu")

                        menu.dataset.submenu = submenuId
                        submenu.id = submenuId

                        contextMenuSubmenus.appendChild(submenu)
                        item.submenu.forEach(submenuItem => {
                            const submenuItemElement = document.createElement("span");
                            submenuItemElement.classList.add("contextmenu-item")
                            if (submenuItem.shortcut) submenuItemElement.innerHTML = `${submenuItem.name ?? submenuItem}<span class="contextmenu-item-shortcut">${submenuItem.shortcut}</span>`
                            else submenuItemElement.innerHTML = submenuItem.name
                            if (item?.role) submenuItemElement.setAttribute("role", item?.role)
                            submenu.appendChild(submenuItemElement)
                        })
                    }
                }
            })
            if (index !== menu.length - 1) contextMenu.innerHTML += `<hr />`
        })
    }
    if (getSelected().length > 1) {
        MenuToElements(MultipleSelectedMenu)
    } else if (target.classList.contains("sidebar-item")) {
        MenuToElements(SidebarMenu)
    } else if (target.classList.contains("drive-item")) {
        MenuToElements(SidebarDriveMenu)
    } else if (isTrash) {
        MenuToElements(TrashMenu)
    } else {
        if (target === document.getElementById("workspace")) MenuToElements(BodyMenu)
        else if (target?.dataset?.path) MenuToElements(FileMenu)
    }

    updateTheme()

    document.querySelectorAll<HTMLElement>(".contextmenu-item").forEach(menu => {
        if (menu.dataset.submenu) {
            const submenu = document.getElementById(menu.dataset.submenu)
            let submenuCoorX = coorX + contextMenu.offsetWidth
            const submenuCoorY = coorY + menu.offsetTop

            if (coorX + contextMenu.offsetWidth > window.innerWidth) submenuCoorX = coorX - contextMenu.offsetWidth

            submenu.style.left = submenuCoorX + "px"
            submenu.style.top = submenuCoorY + "px"

            const clearLayoutModeClasses = (element:HTMLElement) => {
                element.classList.remove("large-grid-view")
                element.classList.remove("medium-grid-view")
                element.classList.remove("small-grid-view")
                element.classList.remove("detail-view")
            }

            const clickSubmenuEvent = (e:Event) => {
                const target = e.target as HTMLElement;
                if (target.getAttribute("role")) {
                    const files = document.querySelectorAll<HTMLElement>(".file")
                    const layout = storage.get('layout')?.data ?? {}
                    const sort = storage.get('layout')?.data ?? {}
                    const tabs = storage.get(`tabs-${windowGUID}`)?.data
                    let currentPath = tabs.tabs[tabs.focus].position
                    if ( currentPath === "xplorer://Home") currentPath = os.homedir()
                    switch (target.innerHTML) {
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
                            open(currentPath)
                            break;
                        case "Z-A":
                            sort[currentPath] = "Z" // Z = Z - A
                            storage.set("sort", sort)
                            open(currentPath)
                            break;
                        case "Last Modified":
                            sort[currentPath] = "L" // L = Last Modified
                            storage.set("sort", sort)
                            open(currentPath)
                            break;
                        case "First Modified":
                            sort[currentPath] = "F" // F = First Modified
                            storage.set("sort", sort)
                            open(currentPath)
                            break;
                        case "Size":
                            sort[currentPath] = "S" // S = Size
                            storage.set("sort", sort)
                            open(currentPath)
                            break;
                        case "Type":
                            sort[currentPath] = "T" // T = Type
                            storage.set("sort", sort)
                            open(currentPath)
                            break;
                    }
                    if (target.innerHTML.startsWith("File")) {
                        NewFile("new file")
                    } else if (target.innerHTML.startsWith("Folder")) {
                        NewFile("new folder")
                    }
                }
            }

            const onhover = () => {
                document.querySelectorAll<HTMLElement>(".contextmenu-submenu").forEach(submenu => submenu.style.display = "none")
                submenu.style.display = "block"
                submenu.addEventListener("click", clickSubmenuEvent)
            }
            const onstophover = () => {
                const trackMousePosition = (e:Event) => {
                    if (e.target !== menu.parentElement) {
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

/**
 * Create context menu of an elememt
 * @param {HTMLElement} element - Element you want to create context menu of
 * @param {openFileWithDefaultApp} openFileWithDefaultApp - openFileWithDefaultApp function (optional), pass in the function to avoid circular dependencies
 * @param {open} open - open function (optional), pass in the function to avoid circular dependencies
 * @returns {void}
 */
const ContextMenu = (element:HTMLElement, openFileWithDefaultApp?: openFileWithDefaultApp, open?: open):void => {
    // Escape circular dependency
    if (!openFileWithDefaultApp) openFileWithDefaultApp = require('../Files/File Operation/open').openFileWithDefaultApp //eslint-disable-line @typescript-eslint/no-var-requires
    if (!open) open = require('../Files/File Operation/open').open //eslint-disable-line @typescript-eslint/no-var-requires

    const { reload } = require("../Layout/windowManager"); //eslint-disable-line @typescript-eslint/no-var-requires

    element.addEventListener("contextmenu", e => {
        // Disable context menu if current path is home and on windows
        if (process.platform === "win32" && (!document.getElementById("workspace").dataset?.path || document.getElementById("workspace").dataset?.path === "xplorer://Home")) return;
        const coorX = e.pageX;
        let coorY = e.pageY;

        const TOPBAR_ELEMENT = document.querySelector<HTMLElement>(".topbar");

        if (contextMenu.offsetHeight + coorY > window.innerHeight && coorY - contextMenu.offsetHeight > TOPBAR_ELEMENT.offsetHeight)
            coorY = coorY - (contextMenu.offsetHeight * .5);

        contextMenu.style.left = coorX + "px";
        contextMenu.style.top = coorY + "px";
        ContextMenuInner(e.target as HTMLElement, coorX, coorY, open)

        contextMenu.querySelectorAll("span").forEach(menu => {
            menu.addEventListener("click", () => {
                let target = e.target as HTMLElement;
                while (!target.dataset.path) {
                    target = target.parentNode as HTMLElement
                }
                const filePath = unescape(target.dataset.path)
                let paths;
                switch (menu.getAttribute("role")) {
                    case "open":
                    case "openInNewTab":
                        if (menu.getAttribute("role") === "openInNewTab") {
                            const { createNewTab } = require('../Layout/tab');//eslint-disable-line @typescript-eslint/no-var-requires
                            createNewTab(filePath)
                        }
                        if (target.dataset.isdir !== 'true') {
                            const recents = storage.get('recent')?.data;
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
                            open(filePath)
                        }
                        break;
                    case "openMultipleTabs":
                        const { createNewTab } = require('../Layout/tab');//eslint-disable-line
                        for (const element of getSelected()) {
                            if (element.dataset.isdir === 'true') {
                                createNewTab(unescape(element.dataset.path))
                                if (element === getSelected()[getSelected().length - 1]) reload()
                            }
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
                        if (process.platform === "linux" && (filePath === "xplorer://Home")) execSync(`code ${os.homedir()}`)
                        else exec(`code "${filePath.replaceAll('"', "\\\"")}"`)
                        break;
                    case "codes":
                        for (const element of getSelected()) {
                            const selectedPath = unescape(element.dataset.path)
                            if (process.platform === "linux" && (filePath === "xplorer://Home")) execSync(`code ${os.homedir()}`)
                            else exec(`code "${selectedPath.replaceAll('"', "\\\"")}"`)
                        }
                        break;
                    case "refresh":
                        reload()
                        break;
                    case "location":
                        copyLocation(target);
                        break;
                    case "rename":
                        Rename(filePath)
                        break;
                    case "cut":
                        Cut([filePath])
                        break;
                    case "cuts":
                        paths = []
                        for (const element of getSelected()) {
                            paths.push(unescape(element.dataset.path))
                        }
                        Cut(paths)
                        break;
                    case "copy":
                        Copy([filePath])
                        break;
                    case "copies":
                        paths = []
                        for (const element of getSelected()) {
                            paths.push(unescape(element.dataset.path))
                        }
                        Copy(paths)
                        break;
                    case "paste":
                        Paste(focusingPath())
                        break;
                    case "pin":
                        Pin([filePath === "xplorer://Home" ? os.homedir() : filePath ?? focusingPath()])
                        break;
                    case "pins":
                        paths = []
                        for (const element of getSelected()) {
                            paths.push(unescape(element.dataset.path))
                        }
                        Pin(paths)
                        break;
                    case "restore":
                        Restore(filePath)
                        break;
                    case "delete":
                        Trash([filePath])
                        break;
                    case "deletes":
                        paths = []
                        for (const element of getSelected()) {
                            paths.push(unescape(element.dataset.path))
                        }
                        Trash(paths)
                        break;
                    case "unlink":
                        PermanentDelete([unescape(target.dataset.realPath)])
                        break;
                    case "preview":
                        Preview(filePath)
                        break;
                    case "properties":
                        Properties(filePath)
                        break;
                    case "undo":
                        Undo()
                        break
                    case "redo":
                        Redo()
                        break
                }
            })
        })


        const exitContextMenu = (e:Event) => {
            if (!(e.target as HTMLElement).classList.contains("contextmenu-item")) {
                contextMenu.style.left = "-100vw";
                contextMenu.style.top = "-100vh";
                contextMenuSubmenus.innerHTML = ""
                document.body.removeEventListener("click", exitContextMenu)
            }
        }
        document.body.addEventListener("click", exitContextMenu)
    })
}

/**
 * Create context menus of elements
 * @param {NodeListOf<Element>} elements - Elements you want to create context menus on
 * @returns {void}
 */
const createContextMenus = (elements:NodeListOf<Element>):void => {
    elements.forEach(element => ContextMenu(element as HTMLElement))
}

export { ContextMenu, createContextMenus }