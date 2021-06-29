/**
 * Shortcut initializer function for Xplorer
 * @returns {any}
 */
const Shortcut = () => {
    document.addEventListener("keydown", e => {
        if (e.key === "a" && e.ctrlKey) {
           document.querySelectorAll(".file").forEach(element => element.classList.add("selected"))
       }
   }) 
}

module.exports = Shortcut