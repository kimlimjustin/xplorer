const fs = require('fs');
const path = require('path');
const VanillaTilt = require('../../../lib/tilt/tilt');

// Function to simulate hover effect
const hoverEffect = (element, before, after) => {
    element.addEventListener("mouseover", (e) => {
        element.style.background = after
        element.addEventListener("mouseout", () => {
            element.style.background = before
        })
    });
}

// Function to change an element style
const changeElementTheme = (element, variable, style, theme) => {
    const themeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", "config/theme.json")));
    if(element) element.style[style] = themeJSON[theme][variable]
}

// Change page theme
const changeTheme = (document, theme) => {
    const themeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", "config/theme.json")));
    changeElementTheme(document.body, "mainBackground", "background", theme)
    changeElementTheme(document.body, "textColor", "color", theme)
    changeElementTheme(document.body, "fontSize", "fontSize", theme)
    changeElementTheme(document.body, "fontFamily", "fontFamily", theme)
    document.body.style.setProperty("--scrollbar-track", themeJSON[theme].scrollbarTrackBackground)
    document.body.style.setProperty("--scrollbar-thumb", themeJSON[theme].scrollbarThumbBackground)
    document.body.style.setProperty("--scrollbar-thumb-hover", themeJSON[theme].scrollbarThumbHoverBackground)

    changeElementTheme(document.querySelector(".topbar"), "topbarBackground", "background", theme)
    changeElementTheme(document.querySelector(".sidebar"), "sidebarBackground", "background", theme)
    changeElementTheme(document.querySelector("#minimize"), "minimizeBackground", "background", theme)
    changeElementTheme(document.querySelector("#minimize"), "minimizeColor", "color", theme)
    changeElementTheme(document.querySelector("#maximize"), "maximizeBackground", "background", theme)
    changeElementTheme(document.querySelector("#maximize"), "maximizeColor", "color", theme)
    changeElementTheme(document.querySelector("#exit"), "exitBackground", "background", theme)
    changeElementTheme(document.querySelector("#exit"), "exitColor", "color", theme)
    changeElementTheme(document.querySelector(".create-new-tab"), "newTabBackground", "background", theme)
    changeElementTheme(document.querySelector(".create-new-tab"), "newTabColor", "color", theme)
    changeElementTheme(document.querySelector("#go-back"), "navigatorBackground", "background", theme)
    changeElementTheme(document.querySelector("#go-back"), "navigatorColor", "color", theme)
    changeElementTheme(document.querySelector("#go-forward"), "navigatorBackground", "background", theme)
    changeElementTheme(document.querySelector("#go-forward"), "navigatorColor", "color", theme)
    changeElementTheme(document.querySelector("#refresh"), "navigatorBackground", "background", theme)
    changeElementTheme(document.querySelector("#refresh"), "navigatorColor", "color", theme)
    changeElementTheme(document.querySelector(".path-navigator"), "pathNavigatorBackground", "background", theme)
    changeElementTheme(document.querySelector(".path-navigator"), "pathNavigatorColor", "color", theme)
    changeElementTheme(document.querySelector(".menu-dropdown"), "menuDropdownBackground", "background", theme)
    changeElementTheme(document.querySelector(".menu-dropdown"), "menuDropdownColor", "color", theme)
    changeElementTheme(document.querySelector(".sidebar-setting-btn"), "settingButtonBackground", "background", theme)
    changeElementTheme(document.querySelector(".sidebar-setting-btn"), "settingButtonColor", "color", theme)
    document.querySelector(".tabs-manager").style.setProperty("--tabs-scrollbar-track", themeJSON[theme].tabsScrollbarTrack)
    document.querySelector(".tabs-manager").style.setProperty("--tabs-scrollbar-thumb", themeJSON[theme].tabsScrollbarThumb)
    document.querySelector(".tabs-manager").style.setProperty("--tabs-scrollbar-thumb-hover", themeJSON[theme].tabsScrollbarThumbHover)
    document.querySelectorAll(".tab").forEach(tab => {
        changeElementTheme(tab, "tabBackground", "background", theme)
        changeElementTheme(tab, "tabColor", "color", theme)
    })
    document.querySelectorAll(".favorite").forEach(favorite => {
        changeElementTheme(favorite, "favoriteBackground", "background", theme)
        changeElementTheme(favorite, "favoriteColor", "color", theme)
        hoverEffect(favorite, themeJSON[theme].favoriteBackground, themeJSON[theme].favoriteHoverBackground)
    })
    document.querySelectorAll(".pendrive").forEach(pendrive => {
        changeElementTheme(pendrive, "pendriveBackground", "background", theme)
        changeElementTheme(pendrive, "pendriveColor", "color", theme)
        hoverEffect(pendrive, themeJSON[theme].pendriveBackground, themeJSON[theme].pendriveHoverBackground)
    })
    document.querySelectorAll(".pendrive-total-capacity").forEach(bar => {
        changeElementTheme(bar, "pendriveTotalCapacityBackground", "background", theme)
    })
    document.querySelectorAll(".pendrive-used-capacity").forEach(bar => {
        changeElementTheme(bar, "pendriveUsedCapacityBackground", "background", theme)
    })
    document.querySelectorAll(".file-grid").forEach(grid => {
        changeElementTheme(grid, "gridBackground", "background", theme)
        changeElementTheme(grid, "gridColor", "color", theme)
        hoverEffect(grid, themeJSON[theme].gridBackground, themeJSON[theme].gridHoverBackground)
    })
    VanillaTilt();
}

const getThemeJSON = () => {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", "config/theme.json")));
}

module.exports = { changeTheme, getThemeJSON }