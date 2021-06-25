/**
 * Select a file grid
 * @param {any} element - element you want to selefct
 * @param {boolean} ctrl - does user pressing ctrl while clicking the file grid
 * @param {boolean} shift - does user pressing shift while clicking the file grid
 * @returns {any}
 */
const Select = (element, ctrl, shift) => {
    if (!ctrl) document.querySelectorAll(".selected").forEach(element => element.classList.remove("selected"))
    // add 'selected' class if element classlist does not contain it...
    if (!element.classList.contains("selected")) element.classList.add("selected")
    // ...Otherwise, remove it
    else element.classList.remove("selected")
}

const SelectListener = (elements) => {
    elements.forEach(element => {
        element.addEventListener("click", e => {
            Select(element, e.ctrlKey, e.shiftKey)
        })
    })
}

const getSelected = () => {

}

module.exports = { Select, SelectListener };