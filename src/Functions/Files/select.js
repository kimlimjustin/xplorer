const storage = require("electron-json-storage-sync");
const { isHiddenFile } = require("is-hidden-file");
let latestSelected;
let latestShiftSelected;
let initialized = false;
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
    if (!ctrl && !shift) unselectAllSelected()
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
    else {
        latestSelected = element
        latestShiftSelected = element
    }
}

/**
 * Select shortcut initializer
 * @returns {any}
 */
const Initializer = () => {
    /**
     * Select the first file there in case the latest selected file is not exist
     * @returns {any}
     */
    const selectFirstFile = () => {
        const firstFileElement = document.getElementById("main").querySelector(`.file${isHiddenFile ? ":not([data-hidden-file])" : ""}`)
        firstFileElement.classList.add("selected")
        latestSelected = firstFileElement
    }
    const selectShortcut = (e) => {
        const hideHiddenFiles = storage.get("preference")?.data?.hideHiddenFiles ?? true
        if (e.key === "ArrowRight") {
            if (Array.from(latestSelected.parentNode.children).indexOf(latestShiftSelected) < Array.from(latestSelected.parentNode.children).indexOf(latestSelected)) latestShiftSelected = latestSelected
            if (!document.contains(latestSelected)) { selectFirstFile(); return; }
            e.preventDefault()
            let nextSibling = e.shiftKey ? latestShiftSelected.nextSibling : latestSelected.nextSibling;
            if (hideHiddenFiles) {
                while (nextSibling && nextSibling.dataset.hiddenFile !== undefined) {
                    nextSibling = nextSibling.nextSibling
                }
            }
            if (nextSibling?.className.split(' ').some(function (c) { return /file/.test(c); })) {
                unselectAllSelected()
                if (e.shiftKey) {
                    let start = false
                    for (const sibling of latestSelected.parentNode.children) {
                        if (start || sibling === nextSibling || sibling === latestSelected) sibling.classList.add("selected")
                        if (sibling === latestSelected) start = true
                        if (sibling === nextSibling) break;
                    }
                    latestShiftSelected = nextSibling
                } else {
                    latestSelected.classList.remove("selected")
                    latestSelected = nextSibling
                    nextSibling.classList.add("selected")
                }
            }
        }
        else if (e.key === "ArrowLeft") {
            if (Array.from(latestSelected.parentNode.children).indexOf(latestShiftSelected) > Array.from(latestSelected.parentNode.children).indexOf(latestSelected)) latestShiftSelected = latestSelected
            if (!document.contains(latestSelected)) { selectFirstFile(); return; }
            e.preventDefault()
            let previousSibling = e.shiftKey ? latestShiftSelected.previousSibling : latestSelected.previousSibling;
            if (hideHiddenFiles) {
                while (previousSibling && previousSibling.dataset.hiddenFile !== undefined) {
                    previousSibling = previousSibling.previousSibling
                }
            }
            if (previousSibling?.className.split(' ').some(function (c) { return /file/.test(c); })) {
                let start = false
                unselectAllSelected()
                if (e.shiftKey) {
                    for (const sibling of latestSelected.parentNode.children) {
                        if (start || sibling === previousSibling || sibling === latestSelected) sibling.classList.add("selected")
                        if (sibling === previousSibling) start = true
                        if (sibling === latestSelected) break;
                    }
                    latestShiftSelected = previousSibling
                }
                else {
                    latestSelected.classList.remove("selected")
                    latestSelected = previousSibling
                    previousSibling.classList.add("selected")
                }
            }
        }
        else if (e.key === "ArrowDown") {
            if (Array.from(latestSelected.parentNode.children).indexOf(latestShiftSelected) < Array.from(latestSelected.parentNode.children).indexOf(latestSelected)) latestShiftSelected = latestSelected
            if (!document.contains(latestSelected)) { selectFirstFile(); return; }
            e.preventDefault()
            let totalGridInArrow = Math.floor(latestSelected.parentNode.offsetWidth / (latestSelected.offsetWidth + parseInt(getComputedStyle(latestSelected).marginLeft) * 2)) // Calculate the total of grids in arrow
            const siblings = latestSelected.parentNode.children
            let elementBelow = siblings[Array.from(siblings).indexOf(e.shiftKey ? latestShiftSelected : latestSelected) + totalGridInArrow]
            if (hideHiddenFiles) {
                while (elementBelow && elementBelow.dataset.hiddenFile !== undefined) {
                    elementBelow = siblings[Array.from(siblings).indexOf(elementBelow) + totalGridInArrow]
                }
            }
            if (elementBelow?.className.split(' ').some(function (c) { return /file/.test(c); })) {
                let start = false;
                unselectAllSelected()
                if (e.shiftKey) {
                    for (const sibling of latestSelected.parentNode.children) {
                        if (start || sibling === elementBelow || sibling === latestSelected) sibling.classList.add("selected")
                        if (sibling === latestSelected) start = true
                        if (sibling === elementBelow) break;
                    }
                    latestShiftSelected = elementBelow
                } else {
                    latestSelected.classList.remove("selected")
                    latestSelected = elementBelow
                    elementBelow.classList.add("selected")
                }
            }
        }
        else if (e.key === "ArrowUp") {
            if (Array.from(latestSelected.parentNode.children).indexOf(latestShiftSelected) > Array.from(latestSelected.parentNode.children).indexOf(latestSelected)) latestShiftSelected = latestSelected
            if (!document.contains(latestSelected)) { selectFirstFile(); return; }
            e.preventDefault()
            let totalGridInArrow = Math.floor(latestSelected.parentNode.offsetWidth / (latestSelected.offsetWidth + parseInt(getComputedStyle(latestSelected).marginLeft) * 2)) // Calculate the total of grids in arrow
            const siblings = latestSelected.parentNode.children
            let elementAbove = siblings[Array.from(siblings).indexOf(e.shiftKey ? latestShiftSelected : latestSelected) - totalGridInArrow]
            if (hideHiddenFiles) {
                while (elementAbove && elementAbove.dataset.hiddenFile !== undefined) {
                    elementAbove = siblings[Array.from(siblings).indexOf(elementAbove) - totalGridInArrow]
                }
            }
            if (elementAbove?.className.split(' ').some(function (c) { return /file/.test(c); })) {
                let start = false;
                unselectAllSelected()
                if (e.shiftKey) {
                    for (const sibling of latestSelected.parentNode.children) {
                        if (start || sibling === elementAbove || sibling === latestSelected) sibling.classList.add("selected")
                        if (sibling === elementAbove) start = true
                        if (sibling === latestSelected) break;
                    }
                    latestShiftSelected = elementAbove
                } else {
                    latestSelected.classList.remove("selected")
                    latestSelected = elementAbove
                    elementAbove.classList.add("selected")
                }
            }
        }
    }
    document.addEventListener("keydown", selectShortcut)
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
            unselectAllSelected()
        }
    })

    if (!initialized) {
        Initializer()
        initialized = true
    }

}
/**
 * Unselect all selected file grids.
 * @returns {any}
 */
const unselectAllSelected = () => {
    document.querySelectorAll(".selected").forEach(element => element.classList.remove("selected"))
    return;
}

const getSelected = () => {
    return document.querySelectorAll(".selected")
}

module.exports = { Select, SelectListener };