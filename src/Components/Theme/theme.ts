import fs from 'fs';
import storage from "electron-json-storage-sync";
import VanillaTilt from "../../Lib/tilt/tilt";
import os from "os";
import { nativeTheme } from '@electron/remote';
import { ipcRenderer } from 'electron';
interface Theme{
    [key:string]: {
        [key:string]: any //eslint-disable-line
    }
}

/**
 * Detect system theme
 * @returns {string}
 */
 const detectDefaultTheme = (): string => {
	if (nativeTheme.shouldUseDarkColors) {
		return 'dark';
	} else {
		return 'light';
	}
};

let defaultTheme = detectDefaultTheme(); // default system theme
// Watch native theme to be updated
nativeTheme.on('updated', () => {
    defaultTheme = detectDefaultTheme()
    ipcRenderer.send('update-theme');
    updateTheme()
})
let themeJSON:Theme; // user preference theme json
import * as defaultThemeData from "./theme.json"
const defaultThemeJSON:Theme = defaultThemeData;

/**
 * Create a hover effect of an element
 * @param {HTMLElement} element - Element you wanna to give hover effect
 * @param {string} before - Style before hover
 * @param {string} after - Style on hover
 * @returns {void}
 */
const hoverEffect = (element:HTMLElement, before:string, after:string): void => {
    element.addEventListener("mouseover", () => {
        element.style.background = after
        element.addEventListener("mouseout", () => {
            element.style.background = before
        })
    });
}

const IS_VIBRANCY_SUPPORTED = () => process.platform === 'win32' && parseInt(os.release().split('.')[0]) >= 10 && (storage.get("theme")?.data?.acrylic ?? true)

/**
 * Get style of an element
 * @param {string} variable - What style you wanna get?
 * @param {string} theme - the current theme
 * @returns {string|null} style of the [variable] of the element
 */
const getElementStyle = (variable:string, theme:string): string|null => {
    const isAcrylicElement = (themeJSON?.[theme]?.acrylicEffect || defaultThemeJSON?.[theme]?.acrylicEffect).indexOf(variable) !== -1 && IS_VIBRANCY_SUPPORTED()
    return isAcrylicElement? null : themeJSON?.[theme]?.[variable] || defaultThemeJSON[theme][variable]
}

/**
 * Change style of an element
 * @param {HTMLElement} element - Element you want to change the theme style
 * @param {string} variable - The style you wanna change
 * @param {any} key - CSS key of the style
 * @param {string} theme - current theme
 * @returns {void}
 */
const changeElementTheme = (element:HTMLElement, variable:string, key:string, theme:string): void => {
    const isAcrylicElement = (themeJSON?.[theme]?.acrylicEffect || defaultThemeJSON?.[theme]?.acrylicEffect).indexOf(variable) !== -1 && IS_VIBRANCY_SUPPORTED()
    if (element && !isAcrylicElement) (<any>element.style)[key] = themeJSON?.[theme]?.[variable] || defaultThemeJSON[theme][variable] //eslint-disable-line
}

/**
 * Change page theme
 * @param {Document} document - The HTML Document
 * @param {string} theme - The current theme
 * @returns {void}
 */
const changeTheme = (document:Document, theme:string): void => {
    changeElementTheme(document.querySelector(".main-box"), "mainBackground", "background", theme)
    changeElementTheme(document.body, "textColor", "color", theme)
    changeElementTheme(document.body, "fontSize", "fontSize", theme)
    changeElementTheme(document.body, "fontFamily", "fontFamily", theme)
    document.body.style.setProperty("--scrollbar-track", themeJSON ? themeJSON[theme].scrollbarTrackBackground : defaultThemeJSON[theme].scrollbarTrackBackground)
    document.body.style.setProperty("--scrollbar-thumb", themeJSON ? themeJSON[theme].scrollbarThumbBackground : defaultThemeJSON[theme].scrollbarThumbBackground)
    document.body.style.setProperty("--scrollbar-thumb-hover", themeJSON ? themeJSON[theme].scrollbarThumbHoverBackground : defaultThemeJSON[theme].scrollbarThumbHoverBackground)
    document.body.style.setProperty("--selected-grid-border", themeJSON ? themeJSON[theme].selectedGridBorder : defaultThemeJSON[theme].selectedGridBorder)
    document.body.style.setProperty("--selected-grid-background", themeJSON ? themeJSON[theme].selectedGridBackground : defaultThemeJSON[theme].selectedGridBackground)
    document.body.style.setProperty("--selected-grid-color", themeJSON ? themeJSON[theme].selectedGridColor : defaultThemeJSON[theme].selectedGridColor)

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
    changeElementTheme(document.querySelector(".preview"), "previewFileBackground", "background", theme)
    changeElementTheme(document.querySelector(".preview"), "previewFileColor", "color", theme)
    changeElementTheme(document.querySelector(".preview-exit-btn"), "previewExitButtonBackground", "background", theme)
    changeElementTheme(document.querySelector(".preview-exit-btn"), "previewExitButtonColor", "color", theme)
    changeElementTheme(document.querySelector(".preview-object"), "previewObjectBackground", "background", theme)
    changeElementTheme(document.querySelector(".preview-object"), "previewObjectColor", "color", theme)
    changeElementTheme(document.querySelector(".properties"), "propertiesBackground", "background", theme)
    document.querySelector<HTMLElement>(".preview-object")?.style?.setProperty("--preview-object-table-border", themeJSON ? themeJSON[theme].previewObjectTableBorder : defaultThemeJSON[theme].previewObjectTableBorder)
    document.querySelector<HTMLElement>(".preview-object")?.style?.setProperty("--preview-object-table-row-even-bg", themeJSON ? themeJSON[theme].previewObjectTableRowEvenBackground : defaultThemeJSON[theme].previewObjectTableRowEvenBackground)
    document.querySelector<HTMLElement>(".preview-object")?.style?.setProperty("--preview-object-table-row-even-color", themeJSON ? themeJSON[theme].previewObjectTableRowEvenColor : defaultThemeJSON[theme].previewObjectTableRowEvenColor)
    document.querySelector<HTMLElement>(".preview-object")?.style?.setProperty("--preview-object-table-row-odd-bg", themeJSON ? themeJSON[theme].previewObjectTableRowOddBackground : defaultThemeJSON[theme].previewObjectTableRowOddBackground)
    document.querySelector<HTMLElement>(".preview-object")?.style?.setProperty("--preview-object-table-row-odd-color", themeJSON ? themeJSON[theme].previewObjectTableRowOddColor : defaultThemeJSON[theme].previewObjectTableRowOddColor)
    document.querySelector<HTMLElement>(".preview-object")?.setAttribute("data-theme-category", themeJSON ? themeJSON[theme].themeCategory : defaultThemeJSON[theme].themeCategory)
    document.querySelectorAll<HTMLElement>(".contextmenu-submenu").forEach(submenu => {
        changeElementTheme(submenu, "contextMenuSubmenuBackground", "background", theme)
        changeElementTheme(submenu, "contextMenuSubmenuColor", "color", theme)
    })
    document.querySelector<HTMLElement>(".tabs-manager").style.setProperty("--tabs-scrollbar-track", themeJSON ? themeJSON[theme].tabsScrollbarTrack : defaultThemeJSON[theme].tabsScrollbarTrack)
    document.querySelector<HTMLElement>(".tabs-manager").style.setProperty("--tabs-scrollbar-thumb", themeJSON ? themeJSON[theme].tabsScrollbarThumb : defaultThemeJSON[theme].tabsScrollbarThumb)
    document.querySelector<HTMLElement>(".tabs-manager").style.setProperty("--tabs-scrollbar-thumb-hover", themeJSON ? themeJSON[theme].tabsScrollbarThumbHover : defaultThemeJSON[theme].tabsScrollbarThumbHover)
    document.querySelectorAll<HTMLElement>(".tab").forEach(tab => {
        changeElementTheme(tab, "tabBackground", "background", theme)
        changeElementTheme(tab, "tabColor", "color", theme)
    })
    document.querySelectorAll<HTMLElement>(".favorite").forEach(favorite => {
        changeElementTheme(favorite, "favoriteBackground", "background", theme)
        changeElementTheme(favorite, "favoriteColor", "color", theme)
        hoverEffect(favorite, themeJSON ? themeJSON[theme].favoriteBackground : defaultThemeJSON[theme].favoriteBackground, themeJSON ? themeJSON[theme].favoriteHoverBackground : defaultThemeJSON[theme].favoriteHoverBackground)
    })
    document.querySelectorAll<HTMLElement>(".card-hover-effect").forEach(obj => {
        obj.onmouseleave = () => {
            obj.style.background = null;
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = (e.target as Element).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("cardHoverEffectBackground", theme)} )`;
        })
    })
    document.querySelectorAll<HTMLElement>(".sidebar-hover-effect").forEach(obj => {
        obj.onmouseleave = () => {
            obj.style.background = getElementStyle("sidebarBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = (e.target as Element).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("sidebarHoverEffectBackground", theme)} )`;
        })
    })
    document.querySelectorAll<HTMLElement>(".tab-hover-effect").forEach(obj => {
        obj.onmouseleave = () => {
            obj.style.background = getElementStyle("tabBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = (e.target as Element).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("tabHoverEffectBackground", theme)} )`;
        })
    })
    document.querySelectorAll<HTMLElement>(".grid-hover-effect").forEach(obj => {
        obj.onmouseleave = () => {
            obj.style.background = getElementStyle("gridBackground", theme);
            obj.style.borderImage = null;
        }
        obj.addEventListener("mousemove", (e) => {
            const rect = (e.target as Element).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            obj.style.background = `radial-gradient(circle at ${x}px ${y}px, ${getElementStyle("gridHoverEffectBackground", theme)} )`;
        })
    })
    document.querySelectorAll<HTMLElement>(".pendrive").forEach(pendrive => {
        changeElementTheme(pendrive, "pendriveBackground", "background", theme)
        changeElementTheme(pendrive, "pendriveColor", "color", theme)
        hoverEffect(pendrive, themeJSON ? themeJSON[theme].pendriveBackground : defaultThemeJSON[theme].pendriveBackground, themeJSON ? themeJSON[theme].pendriveHoverBackground : defaultThemeJSON[theme].pendriveHoverBackground)
    })
    document.querySelectorAll<HTMLElement>(".pendrive-total-capacity").forEach(bar => {
        changeElementTheme(bar, "pendriveTotalCapacityBackground", "background", theme)
    })
    document.querySelectorAll<HTMLElement>(".pendrive-used-capacity").forEach(bar => {
        changeElementTheme(bar, "pendriveUsedCapacityBackground", "background", theme)
    })
    document.querySelectorAll<HTMLElement>(".file-grid").forEach(grid => {
        changeElementTheme(grid, "gridBackground", "background", theme)
        changeElementTheme(grid, "gridColor", "color", theme)
    })
    VanillaTilt();
    return;
}

/**
 * Update the entire page theme
 * @returns {Promise<void>}
 */
const updateTheme = async ():Promise<void> => {
    const { data } = storage.get("theme")
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
                themeJSON = JSON.parse(fs.readFileSync(data.themeJSON, 'utf-8'))
                await changeTheme(document, data.theme)
            } else {
                await changeTheme(document, defaultTheme)
            }
        }
    }
    return;
}

export { changeTheme, updateTheme, detectDefaultTheme }