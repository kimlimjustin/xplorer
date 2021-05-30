const storage = require("electron-json-storage-sync");
const tab = require("./tab");
console.log(tab)

let contextMenu = document.querySelector(".contextmenu");
document.addEventListener("DOMContentLoaded", () => contextMenu = document.querySelector(".contextmenu"))

const ContextMenuInner = element => {
    contextMenu.innerHTML = ""
    const FileMenu = [
        [
            { "menu": "Open", "role": "open" },
            { "menu": "Open in new tab", "visible": element?.dataset?.isdir === 'true', "role": "openInNewTab" },
            { "menu": "Open in intregrated terminal", "visible": element?.dataset?.isdir === "true" },
            "Preview"
        ],
        [
            "Cut",
            "Copy",
            "Create Shortcut"
        ],
        [
            "Rename",
            "Delete",
            "Pin to Sidebar"
        ],
        [
            "Properties"
        ]
    ]
    if (element.dataset.path) {
        FileMenu.forEach((section, index) => {
            section.forEach(item => {
                if (item.visible || item.visible === undefined) {
                    const menu = document.createElement('span')
                    menu.innerText = item?.menu || item
                    menu.setAttribute("role", item?.role)
                    contextMenu.appendChild(menu)
                }
            })
            if(index !== FileMenu.length - 1) contextMenu.innerHTML += `<hr />`
        })
    }
}

const ContextMenu = (element, openFileWithDefaultApp, openDir)=> {
    element.addEventListener("contextmenu", e => {
        ContextMenuInner(element)
        contextMenu.style.left = e.pageX + "px";
        contextMenu.style.top = e.pageY + "px";

        if (contextMenu.offsetWidth + e.pageX > window.innerWidth) contextMenu.style.left = e.pageX - contextMenu.offsetWidth + "px";
        if (contextMenu.offsetHeight + e.pageY > window.innerHeight) contextMenu.style.top = e.pageY - contextMenu.offsetHeight + "px";

        contextMenu.querySelectorAll("span").forEach(menu => {
            menu.addEventListener("click", () => {
                switch (menu.getAttribute("role")) {
                    case "open":
                    case "openInNewTab":
                        if (menu.getAttribute("role") === "openInNewTab") {
                            createNewTab()
                        }
                        const filePath = unescape(element.dataset.path)
                        if (element.dataset.isdir !== 'true') {
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
module.exports = ContextMenu