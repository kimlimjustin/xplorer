const copyLocation = require("../Functions/Files/location")
const { getSelected } = require("../Functions/Files/select")

/**
 * Shortcut initializer function for Xplorer
 * @returns {any}
 */
const Shortcut = () => {
    document.addEventListener("keydown", e => {
        if (e.key === "a" && e.ctrlKey) {
           document.querySelectorAll(".file").forEach(element => element.classList.add("selected"))
        }
        if (e.key === "C" && e.altKey && e.shiftKey) {
        copyLocation(getSelected()[0])
        }
   }) 
}

module.exports = Shortcut