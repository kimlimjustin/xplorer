const path = require("path");
const { updateTheme } = require("../Theme/theme");
const FILE_TYPES_AVAILABLE_FOR_PREVIEW = ['.pdf', , '.html', '.docx', '.htm', '.xlsx', '.xls', '.xlsb', 'xls', '.ods', '.fods', '.csv', '.txt', '.py', '.js', '.bat', '.css', '.c++', '.cpp', '.cc', '.c', '.diff', '.patch', '.go', '.java', '.json', '.php', '.ts', '.tsx', '.jsx', '.jpg', '.png', '.gif', '.bmp', '.jpeg', '.jpe', '.jif', '.jfif', '.jfi', '.webp', '.tiff', '.tif', '.ico', '.svg', '.webp']
const mammoth = require("mammoth")
const fs = require('fs');
const XLSX = require('xlsx');
const URLify = require("../DOM/urlify");
const hljs = require('highlight.js');

/**
 * Close the preview file
 * @returns {any}
 */
const closePreviewFile = () => {
    document.getElementById("workspace").classList.remove("workspace-split")
    document.querySelectorAll(".preview").forEach(element => element.parentNode.removeChild(element))
    document.querySelector(".main-box").style.overflowY = "auto";
}
/**
 * Show preview file
 * @param {any} filePath - file to preview
 * @returns {any}
 */
const Preview = (filePath) => {
    const { listenOpen } = require("./open");
    closePreviewFile()
    const previewElement = document.createElement("div")
    previewElement.classList.add("preview")
    const changePreview = (html) => {
        previewElement.innerHTML = `
                <div class="preview-header">
                    <span class="preview-path">${path.basename(filePath)}</span>
                    <span class="preview-exit-btn">&times;</span>
                </div>
                ${html}
                `

        listenOpen(previewElement.querySelectorAll("[data-listenOpen]"))
        document.querySelector(".main-box").scrollTop = "0"
        document.querySelector(".main-box").style.overflowY = "hidden";
        document.getElementById("workspace").classList.toggle("workspace-split")
        document.querySelector(".main-box").appendChild(previewElement)
        previewElement.querySelector(".preview-exit-btn").addEventListener("click", () => closePreviewFile())
    }
    if (path.extname(filePath) === ".pdf") {
        changePreview(`<object data="${filePath}" type="application/pdf" class="preview-object"><embed src="${filePath}" type="application/pdf" /></object>`)
    } else if (path.extname(filePath) === ".html" || path.extname(filePath) === ".htm") {
        changePreview(`<iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`)
    } else if (['.xlsx', '.xls', '.xlsb', 'xls', '.ods', '.fods', '.csv'].indexOf(path.extname(filePath)) !== -1) {
        const xlsxData = XLSX.readFile(filePath)
        let parsedData = XLSX.utils.sheet_to_html(xlsxData.Sheets[xlsxData.SheetNames[0]])
        changePreview(`<div class='preview-object' data-type="xlsx">${URLify(parsedData)}</div>`)
    } else if (path.extname(filePath) === ".txt") {
        changePreview(`<div class='preview-object' data-type="txt">${fs.readFileSync(filePath, "utf8").replaceAll("\n", "<br />")}</div>`)
    } else if (path.extname(filePath) === ".docx") {
        mammoth.convertToHtml({ path: filePath })
            .then(({ value }) => {
                changePreview(`<div class='preview-object' data-type="docx">${value}</div>`)
            })
            .done();
    } else if (['.jpg', '.png', '.gif', '.bmp', '.jpeg', '.jpe', '.jif', '.jfif', '.jfi', '.webp', '.tiff', '.tif', '.ico', '.svg', '.webp'].indexOf(path.extname(filePath)) !== -1) {
        changePreview(`<div class="preview-object" data-type="img"><img src="${filePath}" data-listenOpen data-path="${filePath}" /></div>`)
    } else {
        let language;
        switch (path.extname(filePath)) {
            case ".py":
                language = "python"
                break;
            case ".js":
                language = "javascript"
                break;
            case ".tx":
                language = "typescript"
                break;
            case ".css":
                language = "css";
                break;
            case ".cpp":
            case ".c++":
            case ".cc":
                language = "c++"
                break;
            case ".c":
                language = "c"
                break;
            case ".diff":
            case ".patch":
                language = "diff"
                break;
            case ".json":
                language = "json"
                break;
            
        }
        const highlightedCode = language ? hljs.highlight(fs.readFileSync(filePath, "utf8"), {language: language}).value : hljs.highlightAuto(fs.readFileSync(filePath, "utf8")).value
        changePreview(`<pre class='preview-object' data-type="code"><code>${highlightedCode}</code></pre>`)
    }
    updateTheme()
}

module.exports = { Preview, FILE_TYPES_AVAILABLE_FOR_PREVIEW, closePreviewFile }