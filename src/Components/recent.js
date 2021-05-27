const { startLoading, stopLoading } = require("../Functions/DOM/loading");
const storage = require('electron-json-storage-sync');
const getPreview = require("../Functions/preview/preview");
const LAZY_LOAD = require("../Functions/DOM/lazyLoadingImage");

const Recent = async () => {
    startLoading()
    // Get the main element
    const MAIN_ELEMENT = document.getElementById("main");
    MAIN_ELEMENT.innerHTML = "";
    if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification') // Remove class if exist
    // Get recent files list
    const recents = storage.get('recent')?.data
    if (!recents) {
        MAIN_ELEMENT.classList.add('empty-dir-notification')
        MAIN_ELEMENT.innerText = "This folder is empty."
    } else {
        for (const recent of recents) {
            const preview = await getPreview(recent, category = "file")
            const fileGrid = document.createElement("div")
            fileGrid.className = "file-grid grid-hover-effect"
            fileGrid.setAttribute("draggable", 'true')
            fileGrid.setAttribute("data-listenOpen", '')
            fileGrid.setAttribute("data-tilt", '')
            fileGrid.dataset.path = escape(recent)
            fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${recent.split('\\').pop().split('/').pop()}</span>
            `
            MAIN_ELEMENT.appendChild(fileGrid)
        }
        LAZY_LOAD()
    }
    stopLoading()
}

module.exports = Recent;