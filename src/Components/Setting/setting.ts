import Translate from "../I18n/i18n";
import fileIcon from "../File Icon/fileIcon";
import {updateTheme} from "../Theme/theme";
import storage from "electron-json-storage-sync";
import fs from "fs";
import path from "path";
import {version} from "../../../package.json"
import {reload} from "../Layout/windowManager";
import { ipcRenderer } from "electron";

/**
 * Create appearence section
 * @returns {any}
 */
const Appearance = () => {
    const theme = storage.get("theme")?.data?.theme
    const acrylic = storage.get("theme")?.data?.acrylic ?? true
    const layout = storage.get("preference")?.data?.layout ?? 's'
    const autoPlayPreviewVideo = storage.get("preference")?.data?.autoPlayPreviewVideo
    const extractExeIcon = storage.get("preference")?.data?.extractExeIcon ?? true
    const settingsMain = document.querySelector(".settings-main");
    settingsMain.innerHTML = `<h3 class="settings-title">App Theme</h3>
    <select name="theme">
        <option>System Default</option>
        <option ${theme === "light" ? "selected" : ""} value="light" data-category="light">Light</option>
        <option ${theme === "dark" ? "selected" : ""} value="dark" data-category="dark">Dark</option>
        <option ${theme === "light+" ? "selected" : ""} value="light+" data-category="light">Light+</option>
        <option ${theme === "dark+" ? "selected" : ""} value="dark+" data-category="dark">Dark+</option>
    </select>
    <div class="toggle-box">
        <label class="toggle">
            <input type="checkbox" name="acrylic" ${acrylic ? "checked" : ""} ${process.platform !== "win32" ? "disabled" : ""}>
            <span class="toggle-slider"></span>
            <span class="toggle-label">Acrylic Effect</span>
        </label>
    </div>
    <h3 class="settings-title">File Preview</h3>
    <div class="toggle-box">
        <label class="toggle">
            <input type="checkbox" name="preview-video" ${autoPlayPreviewVideo ? "checked" : ""}>
            <span class="toggle-slider"></span>
            <span class="toggle-label">Auto play video file as preview (May consume high amount of RAM)</span>
        </label>
    </div>
    <div class="toggle-box">
        <label class="toggle">
            <input type="checkbox" name="extract-exe-icon" ${extractExeIcon ? "checked" : ""} ${process.platform !== "win32" ? "disabled" : ""}>
            <span class="toggle-slider"></span>
            <span class="toggle-label">Extract exe file icon and make it as preview (Only for windows)</span>
        </label>
    </div>
    <h3 class="settings-title">Default File Layout</h3>
    <select name="layout">
        <option ${layout === "s" ? "selected" : ""} value="s">Small Grid View</option>
        <option ${layout === "m" ? "selected" : ""} value="m">Medium Grid View</option>
        <option ${layout === "l" ? "selected" : ""} value="l">Large Grid View</option>
        <option ${layout === "d" ? "selected" : ""} value="d">Detail View</option>
    </select>`
    settingsMain.querySelector('[name="theme"]').addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const category = (event.target as unknown as HTMLSelectElement).options[(event.target as unknown as HTMLSelectElement).selectedIndex].dataset.category
        storage.set("theme", { "theme": event.target.value, "category": category, acrylic: document.querySelector<HTMLInputElement>('[name="acrylic"]').checked })
        ipcRenderer.send('update-theme')
        reload()
    })
    settingsMain.querySelector('[name="layout"]').addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {}
        preference.layout = event.target.value;
        storage.set("preference", preference)
    })
    settingsMain.querySelector(`[name="preview-video"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {}
        preference.autoPlayPreviewVideo = event.target.checked;
        storage.set("preference", preference)
        reload()
    })
    settingsMain.querySelector(`[name="extract-exe-icon"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {}
        preference.extractExeIcon = event.target.checked;
        storage.set("preference", preference)
        reload()
    })
    settingsMain.querySelector(`[name="acrylic"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const theme = storage.get("theme")?.data;
        theme.acrylic = event.target.checked;
        storage.set("theme", theme);
        reload()
    })
}

/**
 * Create preference section
 * @returns {any}
 */
const Preference = () => {
    const language = storage.get("preference")?.data?.language
    const hideHiddenFiles = storage.get("preference")?.data?.hideHiddenFiles ?? true
    const hideSystemFiles = storage.get("preference")?.data?.hideSystemFiles ?? true
    const dirAlongsideFiles = storage.get("preference")?.data?.dirAlongsideFiles ?? false
    const settingsMain = document.querySelector(".settings-main");
    const availableLanguages = JSON.parse(fs.readFileSync(path.join(__dirname, "../Locales/index.json"), 'utf-8'))?.availableLanguages
    settingsMain.innerHTML = `<h3 class="settings-title">App Language</h3>
    <select name="language">
    ${Object.keys(availableLanguages).map(lang => {
        return `<option value="${availableLanguages[lang]}" ${language === availableLanguages[lang] ? "selected" : ""}>${lang}</option>`
    })}
    </select>
    <h3 class="settings-title">Files and Folders</h3>
    <div class="toggle-box">
        <label class="toggle">
            <input type="checkbox" name="hide-hidden-files" ${hideHiddenFiles ? "checked" : ""}>
            <span class="toggle-slider"></span>
            <span class="toggle-label">Hide Hidden Files</span>
        </label>
    </div>
    <div class="toggle-box">
        <label class="toggle">
            <input type="checkbox" name="hide-system-files" ${hideSystemFiles ? "checked" : ""}>
            <span class="toggle-slider"></span>
            <span class="toggle-label">Hide System Files</span>
        </label>
    </div>
    <div class="toggle-box">
        <label class="toggle">
            <input type="checkbox" name="dirAlongsideFiles" ${dirAlongsideFiles ? "checked" : ""}>
            <span class="toggle-slider"></span>
            <span class="toggle-label">List and sort directories alongside files</span>
        </label>
    </div>
`
    settingsMain.querySelector(`[name="language"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {}
        preference.language = event.target.value
        storage.set("preference", preference)
        reload()
    })
    settingsMain.querySelector(`[name="hide-hidden-files"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {};
        preference.hideHiddenFiles = event.target.checked;
        storage.set("preference", preference);
        document.getElementById("workspace").dataset.hideHiddenFiles = String(event.target.checked);
        (document.getElementById("show-hidden-files") as HTMLInputElement).checked = !event.target.checked;
    })
    settingsMain.querySelector(`[name="hide-system-files"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {}
        preference.hideSystemFiles = event.target.checked;
        storage.set("preference", preference)
        reload()
    })
    settingsMain.querySelector(`[name="dirAlongsideFiles"]`).addEventListener("change", (event: Event & { target: HTMLInputElement}) => {
        const preference = storage.get("preference")?.data ?? {}
        preference.dirAlongsideFiles = event.target.checked;
        storage.set("preference", preference)
        reload()
    })
}

/**
 * Create about section
 * @returns {any}
 */
const About = () => {
    const settingsMain = document.querySelector(".settings-main");
    settingsMain.innerHTML = `<h3 class="settings-title">Xplorer</h3>
    <h6 class="settings-about-version">Version ${version}</h6>
    <ul>
    <li><a href="https://github.com/kimlimjustin/xplorer">GitHub</a></li>
    <li><a href="https://github.com/kimlimjustin/xplorer/blob/master/LICENSE">License</a></li>
    <li><a href="https://github.com/kimlimjustin/xplorer/graphs/contributors">Contributors</a></li>
    </ul>`
}

/**
 * Setting initializer function
 * @returns {void}
 */
const Setting = ():void => {
    document.querySelector(".sidebar-setting-btn").addEventListener("click", () => {
        document.querySelector<HTMLElement>(".settings").style.animation = "open-setting 1s forwards"

        document.querySelector(".settings-sidebar-heading").innerHTML = Translate(document.querySelector(".settings-sidebar-heading").innerHTML)
        const settingsSidebarItems = document.querySelector(".settings-sidebar-items")
        settingsSidebarItems.innerHTML = ""
        const settingsItem = ["Appearance", "Preference", "About"]

        settingsItem.map(item => {
            const settingsItem = document.createElement("span");
            settingsItem.classList.add("settings-sidebar-item")
            settingsItem.classList.add("sidebar-hover-effect")
            settingsItem.innerHTML = `<img src="${fileIcon(item, "settings", false)}"><span>${item}</span>`
            settingsSidebarItems.appendChild(settingsItem)

            settingsItem.addEventListener("click", () => {
                switch (item) {
                    case "Appearance":
                        Appearance()
                        break;
                    case "Preference":
                        Preference()
                        break;
                    case "About":
                        About()
                        break;
                }
            })
        })
        updateTheme()
        Appearance()

        document.querySelector(".exit-setting-btn").addEventListener("click", () => {
            document.querySelector<HTMLElement>(".settings").style.animation = "close-setting 1s forwards"
        })
    })
}

export default Setting