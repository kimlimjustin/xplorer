const path = require("path");
const { updateTheme } = require("../Theme/theme");
const FILE_TYPES_AVAILABLE_FOR_PREVIEW = ['.pdf', , '.html', '.docx']
const mammoth = require("mammoth")

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
        <div class="preview-header">
            <span class="preview-path">${path.basename(filePath)}</span>
            <span class="preview-exit-btn">&times;</span>
        </div>
        <object data="${filePath}" type="application/pdf" class="preview-object"><embed src="${filePath}" type="application/pdf" /></object>`
    } else if (path.extname(filePath) === ".html") {
        previewElement.innerHTML = `
        <div class="preview-header">
            <span class="preview-path">${path.basename(filePath)}</span>
            <span class="preview-exit-btn">&times;</span>
        </div>
        <iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`
    } else if (path.extname(filePath) === ".docx") {
        previewElement.innerHTML = `
        <div class="preview-header">
            <span class="preview-path">${path.basename(filePath)}</span>
            <span class="preview-exit-btn">&times;</span>
        </div>
        <iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`
        mammoth.convertToHtml({path: filePath})
            .then(({ value }) => {
                console.log(value)
                previewElement.innerHTML = `
                <div class="preview-header">
                    <span class="preview-path">${path.basename(filePath)}</span>
                    <span class="preview-exit-btn">&times;</span>
                </div>
                <div class='preview-object' data-type="docx">${value}</div>`
                /*let doc = previewElement.preview.open("text/html", "replace");
                doc.write(value)
                doc.close();*/
                chng()
            })
            .done();
    }
    const chng = () => {
        document.querySelector(".main-box").scrollTop = "0"
        document.querySelector(".main-box").style.overflowY = "hidden";
        document.getElementById("workspace").classList.toggle("workspace-split")
        document.querySelector(".main-box").appendChild(previewElement)
        document.querySelector(`[data-path="${escape(filePath)}"]`).scrollIntoView()
        previewElement.querySelector(".preview-exit-btn").addEventListener("click", () => closePreviewFile())
    }
    if (path.extname(filePath) === ".pdf" || path.extname(filePath) === ".html") {
        chng()
    }
    updateTheme()
}

module.exports = { Preview, FILE_TYPES_AVAILABLE_FOR_PREVIEW, closePreviewFile }