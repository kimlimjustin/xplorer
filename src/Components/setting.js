const Translate = require("./multilingual")
const getPreview = require("../Functions/preview/preview");
const { updateTheme } = require("../Functions/Theme/theme");
const storage = require("electron-json-storage-sync");
const fs = require("fs");
const path = require("path");
const version = require("../../package.json").version;

const Appearance = () => {
    const theme = storage.get("theme")?.data?.theme
    const autoPlayPreviewVideo = storage.get("preference")?.data?.autoPlayPreviewVideo
    const extractExeIcon = storage.get("preference")?.data?.extractExeIcon ?? true
    let settingsMain = document.querySelector(".settings-main");
    settingsMain.innerHTML = `<h3 class="settings-title">App Theme</h3>
    <select name="theme">
        <option>System Default</option>
        <option ${theme === "light" ? "selected" : ""} value="light">Light</option>
        <option ${theme === "dark" ? "selected" : ""} value="dark">Dark</option>
        <option ${theme === "light+" ? "selected" : ""} value="light+">Light+</option>
        <option ${theme === "dark+" ? "selected" : ""} value="dark+">Dark+</option>
    </select>
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
    </div>`
    settingsMain.querySelector('[name="theme"]').addEventListener("change", ({ target: { value } }) => {
        storage.set("theme", { "theme": value })
        const { reload } = require("./windowManager");
        reload()
    })
    settingsMain.querySelector(`[name="preview-video"]`).addEventListener("change", ({ target: { checked } }) => {
        let preference = storage.get("preference")?.data ?? {}
        preference.autoPlayPreviewVideo = checked
        storage.set("preference", preference)
        const { reload } = require("./windowManager");
        reload()
    })
    settingsMain.querySelector(`[name="extract-exe-icon"]`).addEventListener("change", ({ target: { checked } }) => {
        let preference = storage.get("preference")?.data ?? {}
        preference.extractExeIcon = checked
        storage.set("preference", preference)
        const { reload } = require("./windowManager");
        reload()
    })
}

const Preference = () => {
    const language = storage.get("preference")?.data?.language
    const hideHiddenFiles = storage.get("preference")?.data?.hideHiddenFiles ?? true
    const hideSystemFiles = storage.get("preference")?.data?.hideSystemFiles ?? true
    let settingsMain = document.querySelector(".settings-main");
    const availableLanguages = JSON.parse(fs.readFileSync(path.join(__dirname, "../Languages/index.json")))?.availableLanguages
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
`
    settingsMain.querySelector(`[name="language"]`).addEventListener("change", ({ target: { value } }) => {
        let preference = storage.get("preference")?.data ?? {}
        preference.language = value
        storage.set("preference", preference)
        const { reload } = require("./windowManager");
        reload()
    })
    settingsMain.querySelector(`[name="hide-hidden-files"]`).addEventListener("change", ({ target: { checked } }) => {
        let preference = storage.get("preference")?.data ?? {}
        preference.hideHiddenFiles = checked
        storage.set("preference", preference)
        document.getElementById("main").dataset.hideHiddenFiles = checked
        document.getElementById("show-hidden-files").checked = !checked
    })
    settingsMain.querySelector(`[name="hide-system-files"]`).addEventListener("change", ({ target: { checked } }) => {
        let preference = storage.get("preference")?.data ?? {}
        preference.hideSystemFiles = checked
        storage.set("preference", preference)
        const { reload } = require("./windowManager");
        reload()
    })
}

const About = () => {
    let settingsMain = document.querySelector(".settings-main");
    settingsMain.innerHTML = `<h3 class="settings-title">Xplorer</h3>
    <h6 class="settings-about-version">Version ${version}</h6>
    <ul>
    <li><a href="https://github.com/kimlimjustin/xplorer">GitHub</a></li>
    <li><a href="https://github.com/kimlimjustin/xplorer/blob/master/LICENSE">License</a></li>
    <li><a href="https://github.com/kimlimjustin/xplorer/graphs/contributors">Contributors</a></li>
    </ul>`
}

const Setting = () => {
    document.querySelector(".sidebar-setting-btn").addEventListener("click", () => {
        document.querySelector(".settings").style.animation = "open-setting 1s forwards"

        document.querySelector(".settings-sidebar-heading").innerHTML = Translate(document.querySelector(".settings-sidebar-heading").innerHTML)
        const settingsSidebarItems = document.querySelector(".settings-sidebar-items")
        settingsSidebarItems.innerHTML = ""
        const settingsItem = ["Appearance", "Preference", "About"]

        settingsItem.map(item => {
            const settingsItem = document.createElement("span");
            settingsItem.classList.add("settings-sidebar-item")
            settingsItem.classList.add("sidebar-hover-effect")
            settingsItem.innerHTML = `<img src="${getPreview(item, "settings", false)}"><span>${item}</span>`
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
            document.querySelector(".settings").style.animation = "close-setting 1s forwards"
        })
    })
}

module.exports = Setting