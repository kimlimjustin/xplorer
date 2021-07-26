const path = require("path");
const FILE_TYPES_AVAILABLE_FOR_PREVIEW = ['.pdf']
/**
 * Show preview file
 * @param {any} filePath - file to preview
 * @returns {any}
 */
const Preview = (filePath) => {
    const previewElement = document.createElement("div")
    previewElement.classList.add("preview")
    if (path.extname(filePath) === ".pdf") {
        previewElement.innerHTML = `<object data="${filePath}" type="application/pdf" class="preview-object"><embed src="${filePath}" type="application/pdf" /></object>`
    }
    document.querySelector(".main-box").appendChild(previewElement)
}

module.exports = { Preview, FILE_TYPES_AVAILABLE_FOR_PREVIEW }