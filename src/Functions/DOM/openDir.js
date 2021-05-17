const { getFilesAndDir } = require("../Files/get");
const getPreview = require("../preview/preview");
const changeContent = require("./changeContent");
const path = require('path');

const openDir = (dir) => {
    getFilesAndDir(dir, async files => {
        const result = document.createElement("div");
        for (const file of files) {
            const preview = await getPreview(path.join(dir, file.filename), category = file.isDir ? "folder" : "file")
            result.innerHTML += `<div class="file-grid" draggable="true" data-isdir=${file.isDir} data-path = ${path.join(dir, file.filename)}>
            ${preview}
            <span class="file-grid-filename" id="file-filename">${file.filename}</span>
            </div>`
        }
        changeContent(result)
    })
}

module.exports = openDir