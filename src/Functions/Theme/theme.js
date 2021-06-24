const fs = require('fs');
const path = require('path');
const VanillaTilt = require('../../../lib/tilt/tilt');
const storage = require("electron-json-storage-sync")
const defaultThemeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", "config/theme.json")));
let themeJSON; // user preference theme json
let defaultTheme; // default system theme

/**
 * Create a hover effect of an element
 * @param {any} element
 * @param {any} before
 * @param {any} after
 * @returns {any}
 */
const hoverEffect = (element, before, after) => {
    element.addEventListener("mouseover", (e) => {
        element.style.background = after
        element.addEventListener("mouseout", () => {
            element.style.background = before
        })
    });
}

/**
 * Get style of an element
 * @param {any} variable
 * @param {any} theme
 * @returns {any}
 */
const getElementStyle = (variable, theme) => {
    return themeJSON?.[theme]?.[variable] || defaultThemeJSON[theme][variable]
}

/**
 * Change style of an element
 * @param {any} element
 * @param {any} variable
 * @param {any} style
 * @param {any} theme
 * @returns {any}
 */
const changeElementTheme = (element, variable, style, theme) => {
    if (element) element.style[style] = themeJSON?.[theme]?.[variable] || defaultThemeJSON[theme][variable]
}

/**
 * Change page theme
 * @param {any} document
 * @param {any} theme
 * @returns {any}
 */
const changeTheme = (document, theme) => {
    changeElementTheme(document.body, "mainBackground", "background", theme)
    changeElementTheme(document.body, "textColor", "color", theme)
    changeElementTheme(document.body, "fontSize", "fontSize", theme)
    changeElementTheme(document.body, "fontFamily", "fontFamily", theme)
    document.body.style.setProperty("--scrollbar-track", themeJSON ? themeJSON[theme].scrollbarTrackBackground : defaultThemeJSON[theme].scrollbarTrackBackground)
    document.body.style.setProperty("--scrollbar-thumb", themeJSON ? themeJSON[theme].scrollbarThumbBackground : defaultThemeJSON[theme].scrollbarThumbBackground)
    document.body.style.setProperty("--scrollbar-thumb-hover", themeJSON ? themeJSON[theme].scrollbarThumbHoverBackground : defaultThemeJSON[theme].scrollbarThumbHoverBackground)

    changeElementTheme(document.querySelector(".loading-bar"), "loadingBar", "background", theme)
    changeElementTheme(document.querySelector(".loader"), "loader", "background", theme)
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
    changeElementTheme(document.querySelector(".settings-sidebar"), "settingsSidebarBackground", "background", theme)
    changeElementTheme(document.querySelector(".settings-main"), "settingsMainBackground", "background", theme)
    changeElementTheme(document.querySelector(".sidebar-setting-btn"), "settingButtonBackground", "background", theme)
    changeElementTheme(document.querySelector(".sidebar-setting-btn"), "settingButtonColor", "color", theme)
    changeElementTheme(document.querySelector(".contextmenu"), "contextMenuBackground", "background", theme)
    changeElementTheme(document.querySelector(".contextmenu"), "contextMenuColor", "color", theme)
    document.querySelectorAll(".contextmenu-submenu").forEach(submenu => {
        changeElementTheme(submenu, "contextMenuSubmenuBackground", "background", theme)
        changeElementTheme(submenu, "contextMenuSubmenuColor", "color", theme)
    })
    document.querySelector(".tabs-manager").style.setProperty("--tabs-scrollbar-track", themeJSON ? themeJSON[theme].tabsScrollbarTrack : defaultThemeJSON[theme].tabsScrollbarTrack)
    document.querySelector(".tabs-manager").style.setProperty("--tabs-scrollbar-thumb", themeJSON ? themeJSON[theme].tabsScrollbarThumb : defaultThemeJSON[theme].tabsScrollbarThumb)
    document.querySelector(".tabs-manager").style.setProperty("--tabs-scrollbar-thumb-hover", themeJSON ? themeJSON[theme].tabsScrollbarThumbHover : defaultThemeJSON[theme].tabsScrollbarThumbHover)
    document.querySelectorAll(".tab").forEach(tab => {
        changeElementTheme(tab, "tabBackground", "background", theme)
        changeElementTheme(tab, "tabColor", "color", theme)
    })
    document.querySelectorAll(".favorite").forEach(favorite => {
        changeElementTheme(favorite, "favoriteBackground", "background", theme)
        changeElementTheme(favorite, "favoriteColor", "color", theme)
        hoverEffect(favorite, themeJSON ? themeJSON[theme].favoriteBackground : defaultThemeJSON[theme].favoriteBackground, themeJSON ? themeJSON[theme].favoriteHoverBackground : defaultThemeJSON[theme].favoriteHoverBackground)
    })
    document.querySelectorAll(".card-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElementStyle("pendriveBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("cardHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElementStyle("cardHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".sidebar-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElementStyle("sidebarBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("sidebarHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElementStyle("sidebarHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".tab-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElementStyle("tabBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("tabHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElementStyle("tabHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".grid-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElementStyle("gridBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("gridHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElementStyle("gridHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".pendrive").forEach(pendrive => {
        changeElementTheme(pendrive, "pendriveBackground", "background", theme)
        changeElementTheme(pendrive, "pendriveColor", "color", theme)
        hoverEffect(pendrive, themeJSON ? themeJSON[theme].pendriveBackground : defaultThemeJSON[theme].pendriveBackground, themeJSON ? themeJSON[theme].pendriveHoverBackground : defaultThemeJSON[theme].pendriveHoverBackground)
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
    })
    VanillaTilt();
    return;
}

/**
 * Update the entire page theme
 * @returns {any}
 */
const updateTheme = async () => {
    const { data } = storage.get("theme")
    // Detect system theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        defaultTheme = "dark"
    } else {
        defaultTheme = "light"
    }
    // If user has no preference theme
    if (!data || !Object.keys(data).length) {
        await changeTheme(document, defaultTheme)
    } else {
        // If user preference is default color theme...
        if (Object.keys(defaultThemeJSON).indexOf(data.theme) !== -1) {
            await changeTheme(document, data.theme)
        }
        else { // Otherwise read user theme json file
            if (data.themeJSON) {
                themeJSON = JSON.parse(fs.readFileSync(data.themeJSON))
                await changeTheme(document, data.theme)
            } else {
                await changeTheme(document, defaultTheme)
            }
        }
    }
    return;
}

module.exports = { changeTheme, updateTheme }