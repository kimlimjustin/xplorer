const path = require("path");
const FILE_TYPES_AVAILABLE_FOR_PREVIEW = ['.pdf']

/**
 * Close the preview file
 * @returns {any}
 */
const closePreviewFile = () => {
    document.getElementById("workspace").classList.remove("workspace-split")
    console.log(document.querySelectorAll(".preview"))
    document.querySelectorAll(".preview").forEach(element => element.parentNode.removeChild(element))
    document.querySelector(".main-box").style.overflowY = "auto";
}
/**
 * Show preview file
 * @param {any} filePath - file to preview
 * @returns {any}
 */
const Preview = (filePath) => {
    closePreviewFile()
    const previewElement = document.createElement("div")
    previewElement.classList.add("preview")
    if (path.extname(filePath) === ".pdf") {
        previewElement.innerHTML = `
        <span class="preview-path">${filePath}</span>
        <span class="preview-exit-btn">&times;</span>
        <object data="${filePath}" type="application/pdf" class="preview-object"><embed src="${filePath}" type="application/pdf" /></object>`
    }
    document.querySelector(".main-box").scrollTop = "0"
    document.querySelector(".main-box").style.overflowY = "hidden";
    document.getElementById("workspace").classList.toggle("workspace-split")
    document.querySelector(`[data-path="${escape(filePath)}"]`).scrollIntoView()
    document.querySelector(".main-box").appendChild(previewElement)
    previewElement.querySelector(".preview-exit-btn").addEventListener("click", () => closePreviewFile())
}

module.exports = { Preview, FILE_TYPES_AVAILABLE_FOR_PREVIEW, closePreviewFile }