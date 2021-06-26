const storage = require("electron-json-storage-sync");
let latestSelected;
/**
 * Select a file grid...
 * 
 * Unselect all selected files and select the clicked file if user's not pressing ctrl nor shift key...
 * 
 * If user pressing ctrl key, select the clicked file without unselect selected files...
 * 
 * If user pressing shift key, select all the range from the clicked file to the latest clicked file
 * @param {any} element - element you want to selefct
 * @param {boolean} ctrl - does user pressing ctrl while clicking the file grid
 * @param {boolean} shift - does user pressing shift while clicking the file grid
 * @param {Array} elements - array of elements that being listened
 * @returns {any}
 */
const Select = (element, ctrl, shift, elements) => {
    if (!ctrl && !shift) document.querySelectorAll(".selected").forEach(element => element.classList.remove("selected"))
    // add 'selected' class if element classlist does not contain it...
    if (!element.classList.contains("selected")) element.classList.add("selected")
    // ...Otherwise, remove it
    else element.classList.remove("selected")
    if (shift && latestSelected) {
        let start = false;
        for (const _element of elements) {
            if (start) _element.classList.add("selected")
            else _element.classList.remove("selected")
            if (_element === latestSelected) {
                start = !start
                _element.classList.add("selected")
            }
            else if (_element === element) {
                start = !start
                _element.classList.add("selected")
            }
        }
    }
    else latestSelected = element
}

/**
 * Select files listener
 * @param {any} elements
 * @returns {any}
 */
const SelectListener = (elements) => {
    elements.forEach(element => {
        element.addEventListener("click", e => {
            Select(element, e.ctrlKey, e.shiftKey, elements)
        })
    })
    document.getElementById("main").addEventListener("click", e => {
        if (!e.target.className.split(' ').some(function (c) { return /file/.test(c); })) {
            document.querySelectorAll(".selected").forEach(element => element.classList.remove("selected"))
        }
    })
    document.addEventListener("keydown", e => {
        const hideHiddenFiles = storage.get("preference")?.data?.hideHiddenFiles ?? true
        if (e.key === "ArrowRight") {
            e.preventDefault()
            let nextSibling = latestSelected.nextSibling;
            if (hideHiddenFiles) {
                while (nextSibling.dataset.hiddenFile !== undefined) {
                    nextSibling = nextSibling.nextSibling
                }
            }
            if (nextSibling?.className.split(' ').some(function (c) { return /file/.test(c); })) {
                latestSelected.classList.remove("selected")
                nextSibling.classList.add("selected")
                latestSelected = nextSibling
            }
        }
        if (e.key === "ArrowLeft") {
            e.preventDefault()
            let previousSibling = latestSelected.previousSibling;
            if (hideHiddenFiles) {
                while (previousSibling.dataset.hiddenFile !== undefined) {
                    previousSibling = previousSibling.previousSibling
                }
            }
            if (previousSibling?.className.split(' ').some(function (c) { return /file/.test(c); })) {
                latestSelected.classList.remove("selected")
                previousSibling.classList.add("selected")
                latestSelected = previousSibling
            }
        }
    })
}

const getSelected = () => {
    return document.querySelectorAll(".selected")
}

module.exports = { Select, SelectListener };