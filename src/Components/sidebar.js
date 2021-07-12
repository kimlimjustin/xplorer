const storage = require('electron-json-storage-sync');
const path = require("path");
const os = require('os');
const { getDrives } = require('./drives');
const getPreview = require('../Functions/preview/preview');
const Translate = require('./multilingual');
const { updateTheme } = require('../Functions/Theme/theme');
const Setting = require('./setting');
const fs = require("fs");
const getDriveBasePath = require('../Functions/Files/basePath');

const changeSidebar = newElement => {
    const { listenOpen } = require('../Functions/Files/open');
    const sidebarElement = document.body.querySelector(".sidebar");
    sidebarElement.parentElement.replaceChild(newElement, sidebarElement);
    updateTheme()
    listenOpen(document.querySelector(".sidebar-nav").querySelectorAll("[data-listenOpen]")) // Listen to open the file
    return;
}

/**
 * Sidebar initializer function
 * @returns {any}
 */
const createSidebar = () => {
    const { ContextMenu } = require('./contextMenu');
    const { data } = storage.get('sidebar'); // Get user favorites data on sidebar
    // Functions to get favorites element
    const getFavoritesElement = favorites => {
        let favoritesElement = ""
        const sidebarElementFavorites = ["Home", "Recent", "Documents", "Desktop", "Downloads", "Pictures", "Music", "Videos", "Trash"]
        for (const favorite of favorites) {
            let isdir;
            try {
                isdir = fs.lstatSync(favorite.path).isDirectory()
            } catch (_) { isdir = true }
            favoritesElement += `<span data-listenOpen data-path = "${favorite.path}" data-isdir="${isdir}" class="sidebar-hover-effect sidebar-item"><img src="${getPreview(favorite.name, category = sidebarElementFavorites.indexOf(favorite.name) === -1 ? isdir ? "folder" : "file" : 'sidebar', HTMLFormat = false)}" alt="${favorite.name} icon"><span class="sidebar-text">${Translate(favorite.name)}</span></span>`
        }
        let result = `<div class="sidebar-nav-item ${data?.hideSection?.favorites ? "nav-hide-item" : ''}">
        <div class="sidebar-hover-effect">
            <span class="sidebar-nav-item-dropdown-btn" data-section="favorites"><img src="${getPreview('Favorites', category = "sidebar", HTMLFormat = false)}" alt="Favorites icon"><span class="sidebar-text">${Translate("Favorites")}</span></span>
        </div>
        <div class="sidebar-nav-item-dropdown-container">
            ${favoritesElement}
        </div>
        </div>`
        return result;
    }

    // Functions to get and display drives on sidebar
    const getDrivesElement = async () => {
        const drives = await getDrives()
        if (!drives.length || process.platform === "darwin") return `<div class="sidebar-nav-item" id="sidebar-drives"></div>` // Return basic sidebar item element if there's no drives detected or its running on macOS
        else {
            let drivesElement = ""
            for (const drive of drives) {
                let driveName = process.platform === "win32" ? `${drive._volumename || drive._filesystem} (${drive._mounted})` : drive._mounted.split("/")[drive._mounted.split("/").length - 1] // Get name of drive
                drivesElement += `<span data-listenOpen data-path = "${getDriveBasePath(drive._mounted)}" data-isdir="true" class="sidebar-hover-effect drive-item"><img src="${getPreview(drive._filesystem === "Removable Disk" ? 'usb' : 'hard-disk', category = 'favorites', HTMLFormat = false)}" alt="${driveName}"><span class="sidebar-text">${driveName}</span></span>`
            }
            let result = `<div class="sidebar-nav-item ${data?.hideSection?.drives ? "nav-hide-item" : ''}" id="sidebar-drives">
                <div class="sidebar-hover-effect">
                <span class="sidebar-nav-item-dropdown-btn" data-section="drives"><img src="${getPreview('hard-disk', category = "favorites", HTMLFormat = false)}" alt="Drives icon"><span class="sidebar-text">${process.platform === "win32" ? Translate("Drives") : Translate("Pendrives")}</span></span>
                </div>
                <div class="sidebar-nav-item-dropdown-container">
                    ${drivesElement}
                </div>
            </div>`
            return result;
        }
    }

    let _favorites = data?.favorites ?? [
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

    getDrivesElement().then(drivesElement => { // get drives element
        let sidebarElement = document.createElement("div");
        sidebarElement.classList.add("sidebar")
        sidebarElement.innerHTML = `
        <span class="xplorer-brand">Xplorer</span>
        <div class="sidebar-nav">
            ${getFavoritesElement(_favorites)}
            ${drivesElement}
        </div>
        <div class="sidebar-setting-btn sidebar-hover-effect">
            <div class="sidebar-setting-btn-inner">
                <img src="${getPreview('setting', category = 'sidebar', HTMLFormat = false)}" alt="Setting icon" class="sidebar-setting-btn-icon">
                <span class="sidebar-setting-btn-text">${Translate("Settings")}</span>
            </div>
        </div>`

        // Collapse section
        sidebarElement.querySelectorAll(".sidebar-nav-item-dropdown-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                e.target.parentNode.parentNode.classList.toggle('nav-hide-item')

                // Save preference into local storage
                const sidebar = storage.get("sidebar")?.data
                if (!sidebar.hideSection) sidebar.hideSection = {} // Initialize if it's not exist
                sidebar.hideSection[e.target.dataset.section] = e.target.parentNode.parentNode.classList.contains('nav-hide-item')
                storage.set("sidebar", sidebar)
            })
        })
        changeSidebar(sidebarElement)
        document.body.querySelector(".sidebar").querySelectorAll(".sidebar-item").forEach(item => {
            ContextMenu(item)
        })
        document.body.querySelector(".sidebar").querySelectorAll(".drive-item").forEach(item => {
            ContextMenu(item)
        })
        Setting()
    })
    let _prevDrives;
    setInterval(() => {
        getDrivesElement().then(_drives => {
            if (_prevDrives === undefined) _prevDrives = _drives
            else {
                if (_drives !== _prevDrives) {
                    const { listenOpen } = require('../Functions/Files/open');
                    const _newElement = document.createElement("div")
                    _newElement.innerHTML = _drives.trim()
                    document.getElementById("sidebar-drives").parentNode.replaceChild(_newElement.firstChild, document.getElementById("sidebar-drives"))
                    updateTheme()
                    listenOpen(document.getElementById("sidebar-drives").querySelectorAll("[data-listenOpen]"))
                }
                _prevDrives = _drives
            }
        })
    }, 500);
    return;
}

module.exports = createSidebar