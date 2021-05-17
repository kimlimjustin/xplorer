const path = require("path");
const storage = require('electron-json-storage-sync')
const fs = require('fs');
const getPreview = require("../preview/preview");

const changeSidebar = newElement => {
    const sidebarElement = document.body.querySelector(".sidebar");
    sidebarElement.parentElement.replaceChild(newElement, sidebarElement);
}

const Sidebar = () => {
    // Functions to get favorites element
    const favoritesElement = favorites => {
        let result = ""
        for(const favorite of favorites){
            result += `<span><img src="${getPreview(favorite, category = 'sidebar', HTMLFormat = false)}" alt="${favorite} icon"> ${favorite}</span>`
        }
        return result;
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
    sidebarElement.innerHTML =  `
    <span class="xplorer-brand">Xplorer</span>
    <div class="sidebar-nav">
        <div class="sidebar-nav-item">
            <span class="sidebar-nav-item-dropdown-btn"><img src="${getPreview('Favorites', category = "sidebar", HTMLFormat = false)}" alt="Favorites icon"> Favorites</span>
            <div class="sidebar-nav-item-dropdown-container">
                ${favoritesElement(_favorites)}
            </div>
        </div>
    </div>
    <div class="sidebar-setting-btn">
        <img src="${getPreview('setting', category= 'sidebar', HTMLFormat = false)}" alt="Setting icon" class="sidebar-setting-btn-icon">
        <span class="sidebar-setting-btn-text">Settings</span>
    </div>`

    sidebarElement.querySelectorAll(".sidebar-nav-item-dropdown-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            e.target.parentNode.classList.toggle('nav-hide-item')
        })
    })

    return sidebarElement
}

module.exports = {changeSidebar, Sidebar}