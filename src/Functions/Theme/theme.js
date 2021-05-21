const fs = require('fs');
const path = require('path');
const VanillaTilt = require('../../../lib/tilt/tilt');
const storage = require("electron-json-storage-sync")
const defaultThemeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", "config/theme.json")));
let themeJSON; // user preference theme json
let defaultTheme; // default system theme

// Function to simulate hover effect
const hoverEffect = (element, before, after) => {
    element.addEventListener("mouseover", (e) => {
        element.style.background = after
        element.addEventListener("mouseout", () => {
            element.style.background = before
        })
    });
}

// Function to get an element style
const getElement = (variable, theme) => {
    const themeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", "config/theme.json")));
    return themeJSON[theme][variable]
}

// Function to change an element style
const changeElementTheme = (element, variable, style, theme) => {
    if(element) element.style[style] = themeJSON? themeJSON[theme][variable] ? themeJSON[theme][variable] : defaultThemeJSON[defaultTheme][variable] : defaultThemeJSON[theme][variable]
}

// Change page theme
const changeTheme = (document, theme) => {
    changeElementTheme(document.body, "mainBackground", "background", theme)
    changeElementTheme(document.body, "textColor", "color", theme)
    changeElementTheme(document.body, "fontSize", "fontSize", theme)
    changeElementTheme(document.body, "fontFamily", "fontFamily", theme)
    document.body.style.setProperty("--scrollbar-track", themeJSON ? themeJSON[theme].scrollbarTrackBackground : defaultThemeJSON[theme].scrollbarTrackBackground)
    document.body.style.setProperty("--scrollbar-thumb", themeJSON ? themeJSON[theme].scrollbarThumbBackground : defaultThemeJSON[theme].scrollbarThumbBackground)
    document.body.style.setProperty("--scrollbar-thumb-hover", themeJSON ? themeJSON[theme].scrollbarThumbHoverBackground : defaultThemeJSON[theme].scrollbarThumbHoverBackground)

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
            obj.style.background = getElement("pendriveBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElement("cardHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElement("cardHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".sidebar-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElement("sidebarBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElement("sidebarHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElement("sidebarHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".tab-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElement("tabBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElement("tabHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElement("tabHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
        })
    })
    document.querySelectorAll(".grid-hover-effect").forEach(obj => {
        obj.onmouseleave = (e) => {
            obj.style.background = getElement("gridBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElement("gridHoverEffectBackground", theme)} )`;
            obj.style.borderImage = `radial-gradient(20% 75% at ${x}px ${y}px, ${getElement("gridHoverEffectBorderImage", theme)} ) 1 / 1px / 0px stretch `;
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

const updateTheme = async () => {
    // Change window theme
    const { data } = storage.get("theme")
    // Detect system theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        defaultTheme = "dark"
    } else {
        defaultTheme = "light"
    }
    // If user has no preference theme
    if(!data || !Object.keys(data).length){
        await changeTheme(document, defaultTheme)
    }else{
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


module.exports = { changeTheme,  updateTheme }