const Translate = require("./multilingual")

const Setting = () => {
    document.querySelector(".sidebar-setting-btn").addEventListener("click", () => {
        document.querySelector(".settings").style.animation = "open-setting 1s forwards"
        document.querySelector(".exit-setting-btn").addEventListener("click", () => {
            document.querySelector(".settings").style.animation = "close-setting 1s forwards"
        })

        document.querySelector(".settings-sidebar-heading").innerHTML = Translate(document.querySelector(".settings-sidebar-heading").innerHTML)
    })
}

module.exports = Setting