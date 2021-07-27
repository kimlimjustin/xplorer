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
        previewElement.innerHTML = `
        <span class="preview-path">${filePath}</span>
        <span class="preview-exit-btn">&times;</span>
        <object data="${filePath}" type="application/pdf" class="preview-object"><embed src="${filePath}" type="application/pdf" /></object>`
    }
    document.querySelector(".main-box").scrollTop = "0"
    document.getElementById("workspace").classList.toggle("workspace-split")
    document.querySelector(".main-box").style.overflowY = "hidden";
    document.querySelector(`[data-path="${escape(filePath)}"]`).scrollIntoView()
    document.querySelector(".main-box").appendChild(previewElement)
}

module.exports = { Preview, FILE_TYPES_AVAILABLE_FOR_PREVIEW }