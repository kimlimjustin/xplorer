const { startLoading, stopLoading } = require("../Functions/DOM/loading");
const storage = require('electron-json-storage-sync');
const getPreview = require("../Functions/preview/preview");
const LAZY_LOAD = require("../Functions/DOM/lazyLoadingImage");
const { updateTheme } = require("../Functions/Theme/theme");
const getType = require("../Functions/Files/type");

/**
 * Recent files handler
 * @returns {any}
 */
const Recent = async () => {
    startLoading()
    // Preference data
    const layout = storage.get("layout")?.data?.["Recent"] ?? storage.get("preference")?.data?.layout ?? "s"
    const sort = storage.get("sort")?.data?.["Recent"] ?? 'A'
    // Get the main element
    const MAIN_ELEMENT = document.getElementById("main");
    MAIN_ELEMENT.innerHTML = "";
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    // Get recent files list
    let recents = storage.get('recent')?.data
    recents = recents.sort((a, b) => {
        switch (sort) {
            case "A": // A-Z
                return a.split('\\').pop().split('/').pop().toLowerCase() > b.split('\\').pop().split('/').pop().toLowerCase() ? 1 : -1
            case "Z": // Z-A
                return a.split('\\').pop().split('/').pop().toLowerCase() < b.split('\\').pop().split('/').pop().toLowerCase() ? 1 : -1
        }
    })
    if (!recents) {
        MAIN_ELEMENT.classList.add('empty-dir-notification')
        MAIN_ELEMENT.innerText = "This folder is empty."
    } else {
        for (const recent of recents) {
            const preview = await getPreview(recent, category = "file")
            const fileGrid = document.createElement("div")
            fileGrid.className = "file-grid file grid-hover-effect"
            switch (layout) {
                case "m":
                    fileGrid.classList.add("medium-grid-view")
                    break;
                case "l":
                    fileGrid.classList.add("large-grid-view")
                    break;
                case "d":
                    fileGrid.classList.add("detail-view")
                    break;
                default:
                    fileGrid.classList.add("small-grid-view")
                    break;

            }
            fileGrid.setAttribute("draggable", 'true')
            fileGrid.setAttribute("data-listenOpen", '')
            fileGrid.setAttribute("data-tilt", '')
            fileGrid.dataset.path = escape(recent)
            fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${recent.split('\\').pop().split('/').pop()}</span>
            <span class="file-type">${getType(recent)}</span>
            `
            MAIN_ELEMENT.appendChild(fileGrid)
        }
        LAZY_LOAD()
        updateTheme()
    }
    stopLoading()
}

module.exports = Recent;