const Translate = require("./multilingual")
const getPreview = require("../Functions/preview/preview");
const { updateTheme } = require("../Functions/Theme/theme");
const storage = require("electron-json-storage-sync");
const theme = storage.get("theme")?.data?.theme

const Appearance = () => {
    let settingsMain = document.querySelector(".settings-main");
    settingsMain.innerHTML = `<h3>App Theme</h3>
    <select>
        <option>System Default</option>
        <option ${theme === "light" ? "selected" : ""} value="light">Light</option>
        <option ${theme === "dark" ? "selected" : ""} value="dark">Dark</option>
        <option ${theme === "light+" ? "selected" : ""} value="light+">Light+</option>
        <option ${theme === "dark+" ? "selected" : ""} value="dark+">Dark+</option>
    </select>`
    settingsMain.querySelector("select").addEventListener("change", ({ target: { value } }) => {
        storage.set("theme", { "theme": value })
        const { reload } = require("./windowManager");
        reload()
    })
}

const Preference = () => {
    let settingsMain = document.querySelector(".settings-main");
    settingsMain.innerHTML = `<h3></h3>`
}

const About = () => {

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