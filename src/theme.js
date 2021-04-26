const fs = require('fs');
const path = require('path');
const changeTheme = (document) => {
    const theme = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config/theme.json")));
    document.body.style.backgroundColor =  theme.default.mainBackground
    document.body.style.color = theme.default.textColor
    document.body.style.fontSize = theme.default.fontSize
    document.body.style.fontFamily = theme.default.fontFamily
    document.querySelector(".topbar").style.backgroundColor = theme.default.topbarBackground
    document.querySelector(".sidebar").style.backgroundColor = theme.default.sidebarBackground
    document.querySelector("#minimize").style.backgroundColor = theme.default.minimizeBackgroundColor
    document.querySelector("#minimize").style.color = theme.default.minimizeColor
    document.querySelector("#maximize").style.backgroundColor = theme.default.maximizeBackgroundColor
    document.querySelector("#maximize").style.color = theme.default.maximizeColor
    document.querySelector("#exit").style.backgroundColor = theme.default.exitBackgroundColor
    document.querySelector("#exit").style.color = theme.default.exitColor
    document.querySelector(".create-new-tab").style.backgroundColor = theme.default.newTabBackgroundColor
    document.querySelector(".create-new-tab").style.color = theme.default.newTabColor
    document.querySelector("#go-back").style.backgroundColor = theme.default.navigatorBackgroundColor
    document.querySelector("#go-back").style.color = theme.default.navigatorColor
    document.querySelector("#go-next").style.backgroundColor = theme.default.navigatorBackgroundColor
    document.querySelector("#go-next").style.color = theme.default.navigatorColor
    document.querySelector("#refresh").style.backgroundColor = theme.default.navigatorBackgroundColor
    document.querySelector("#refresh").style.color = theme.default.navigatorColor
    document.querySelector(".path-navigator").style.backgroundColor = theme.default.pathNavigatorBackgroundColor
    document.querySelectorAll(".tab").forEach(tab => {
        tab.style.backgroundColor = theme.default.tabBackgroundColor
    })
    document.querySelectorAll(".tab").forEach(tab => {
        tab.style.color = theme.default.tabColor
    })
}

module.exports = changeTheme