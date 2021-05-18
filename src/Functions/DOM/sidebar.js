const storage = require('electron-json-storage-sync');
const { getDrives } = require('../../Components/drives');
const getPreview = require("../preview/preview");
const path = require("path");
const os = require('os');

const changeSidebar = newElement => {
    const sidebarElement = document.body.querySelector(".sidebar");
    sidebarElement.parentElement.replaceChild(newElement, sidebarElement);
}

const Sidebar = () => {
    // Functions to get favorites element
    const favoritesElement = favorites => {
        let result = ""
        for(const favorite of favorites){
            result += `<span data-listenOpen data-path = "${path.join(os.homedir(), favorite)}" data-isdir="true"><img src="${getPreview(favorite, category = 'sidebar', HTMLFormat = false)}" alt="${favorite} icon"> ${favorite}</span>`
        }
        return result;
    }

    // Functions to get and display drives on sidebar
    const getDrivesElement = async () => {
        const drives = await getDrives()
        if(!drives.length || process.platform === "darwin") return "" // Return nothing if there's no drives detected or its running on macOS
        else{
            let drivesElement = ""
            for(const drive of drives){
                let driveName = process.platform === "win32" ? `${drive._volumename} (${drive._mounted})`: drive._mounted.split("/")[drive._mounted.split("/").length - 1] // Get name of drive
                drivesElement += `<span data-listenOpen data-path = "${drive._mounted}" data-isdir="true"><img src="${getPreview('usb', category = 'favorites', HTMLFormat = false)}" alt="${driveName}">${driveName}</span>`
            }
            let result = `<div class="sidebar-nav-item">
                <span class="sidebar-nav-item-dropdown-btn"><img src="${getPreview('usb', category = "favorites", HTMLFormat = false)}" alt="Drives icon"> ${process.platform === "win32" ? "Drives" : "Pendrives"}</span>
                <div class="sidebar-nav-item-dropdown-container">
                    ${drivesElement}
                </div>
            </div>`
            return result;
        }
    }

    const {data} = storage.get('sidebar'); // Get user favorites data on sidebar

    let _favorites = ['Home', 'Recent', 'Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Trash']
    // If user has no preference sidebar item
    if(!data || !Object.keys(data).length || !data.favorites.length){
        storage.set('sidebar', {favorites: _favorites})
    }
    else{
        _favorites = data.favorites
    }
    let sidebarElement = document.createElement("div");
    sidebarElement.classList.add("sidebar")

    getDrivesElement().then(drivesElement => { // get drives element
        sidebarElement.innerHTML =  `
        <span class="xplorer-brand">Xplorer</span>
        <div class="sidebar-nav">
            <div class="sidebar-nav-item">
                <span class="sidebar-nav-item-dropdown-btn"><img src="${getPreview('Favorites', category = "sidebar", HTMLFormat = false)}" alt="Favorites icon"> Favorites</span>
                <div class="sidebar-nav-item-dropdown-container">
                    ${favoritesElement(_favorites)}
                </div>
            </div>
            ${drivesElement}
        </div>
        <div class="sidebar-setting-btn">
            <img src="${getPreview('setting', category= 'sidebar', HTMLFormat = false)}" alt="Setting icon" class="sidebar-setting-btn-icon">
            <span class="sidebar-setting-btn-text">Settings</span>
        </div>`

        // Collapse section
        sidebarElement.querySelectorAll(".sidebar-nav-item-dropdown-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                e.target.parentNode.classList.toggle('nav-hide-item')
            })
        })
    })

    return sidebarElement
}

module.exports = {changeSidebar, Sidebar}