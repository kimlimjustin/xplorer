const fs = require('fs');
const path = require('path');
// Change page theme
const changeTheme = (document, theme) => {
    const themeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config/theme.json")));
    document.body.style.background =  themeJSON[theme].mainBackground
    document.body.style.color = themeJSON[theme].textColor
    document.body.style.fontSize = themeJSON[theme].fontSize
    document.body.style.fontFamily = themeJSON[theme].fontFamily
    document.querySelector(".topbar").style.background = themeJSON[theme].topbarBackground
    document.querySelector(".sidebar").style.background = themeJSON[theme].sidebarBackground
    document.querySelector("#minimize").style.background = themeJSON[theme].minimizebackground
    document.querySelector("#minimize").style.color = themeJSON[theme].minimizeColor
    document.querySelector("#maximize").style.background = themeJSON[theme].maximizebackground
    document.querySelector("#maximize").style.color = themeJSON[theme].maximizeColor
    document.querySelector("#exit").style.background = themeJSON[theme].exitbackground
    document.querySelector("#exit").style.color = themeJSON[theme].exitColor
    document.querySelector(".create-new-tab").style.background = themeJSON[theme].newTabBackground
    document.querySelector(".create-new-tab").style.color = themeJSON[theme].newTabColor
    document.querySelector("#go-back").style.background = themeJSON[theme].navigatorBackground
    document.querySelector("#go-back").style.color = themeJSON[theme].navigatorColor
    document.querySelector("#go-forward").style.background = themeJSON[theme].navigatorBackground
    document.querySelector("#go-forward").style.color = themeJSON[theme].navigatorColor
    document.querySelector("#refresh").style.background = themeJSON[theme].navigatorBackground
    document.querySelector("#refresh").style.color = themeJSON[theme].navigatorColor
    document.querySelector(".path-navigator").style.background = themeJSON[theme].pathNavigatorBackground
    document.querySelectorAll(".tab").forEach(tab => {
        tab.style.background = themeJSON[theme].tabBackground
    })
    document.querySelectorAll(".tab").forEach(tab => {
        tab.style.color = themeJSON[theme].tabColor
    })
    document.querySelectorAll(".drive").forEach(drive => {
        drive.style.background = themeJSON[theme].driveBackground
    })
}

const getThemeJSON = () => {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, "config/theme.json")));
}

module.exports = {changeTheme, getThemeJSON}