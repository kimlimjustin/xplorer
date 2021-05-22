const fs = require('fs');
const path = require('path');
const storage = require('electron-json-storage-sync');

const defaultIconJSON = JSON.parse(fs.readFileSync(path.join(__dirname, "../../config/icon.json")))
let iconJSON = null;

const IMAGE = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico', 'svg', 'webp'];
const VIDEO = ['mp4', 'webm', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'ocg', 'm4p', 'm4v', 'avi', 'wmv', 'mov', 'qt', 'flv', 'swf'];

// Return image view of preview
const iconPreview = (filename) => {
    return `<img data-src = "${filename}" class="file-grid-preview" />`
}
// Return video view of preview
const videoPreview = (filename, iconJSON) => {
    let alt = path.join(__dirname, "../../icon/", iconJSON.file.video) // Alternative for video if video could not be oaded
    return `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>`
}

const getPreview = (filename, category = "folder", HTMLFormat = true) => {
    // Get user preference on icon
    const icon = storage.get('icon')

    if (icon.data && fs.existsSync(icon.data.iconJSON)) iconJSON = JSON.parse(fs.readFileSync(icon.data.iconJSON))

    const ext = filename.split('.').pop().toLowerCase() // Get extension of filename

    if (IMAGE.indexOf(ext) !== -1) return HTMLFormat ? iconPreview(filename) : filename // Show the image itself if the file is image
    else if (VIDEO.indexOf(ext) !== -1) return HTMLFormat ? videoPreview(filename, iconJSON ? iconJSON : defaultIconJSON) : filename // Show the video itself if the file is video

    filename = filename.toLowerCase() // Lowercase filename

    const folderName = filename.split(/[\\\/]/).pop()

    // Check if there's a icon for the folder name
    if (Object.keys(iconJSON ? iconJSON[category] : defaultIconJSON[category]).indexOf(category === "file" ? ext : folderName) !== -1) {
        let fileLoc = iconJSON ? iconJSON[category][category === "file" ? ext : folderName][0] === "/" ? iconJSON[category][category === "file" ? ext : folderName] : path.join(icon.data.iconJSON, '../', iconJSON[category][category === "file" ? ext : folderName]) : defaultIconJSON[category][category === "file" ? ext : folderName][0] === "/" ? defaultIconJSON[category][category === "file" ? ext : folderName] : path.join(__dirname, "../../icon/", defaultIconJSON[category][category === "file" ? ext : folderName]) // Icon file loc for user preference based icon

        if (fs.existsSync(fileLoc)) return HTMLFormat ? iconPreview(fileLoc) : fileLoc
        else return HTMLFormat ? iconPreview(path.join(__dirname, "../../icon/", defaultIconJSON[category][folderName])) : path.join(__dirname, "../../icon/", defaultIconJSON[category][folderName])
    } else {
        let fileLoc = iconJSON ? iconJSON.default[category === "file" ? "file" : "folder"][0] === "/" ? iconJSON.default[category === "file" ? "file" : "folder"] : path.join(icon.data.iconJSON, '../', iconJSON.default[category === "file" ? "file" : "folder"]) : defaultIconJSON.default[category === "file" ? "file" : "folder"][0] === "/" ? defaultIconJSON.default[category === "file" ? "file" : "folder"] : path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default[category === "file" ? "file" : "folder"] : defaultIconJSON.default[category === "file" ? "file" : "folder"])// Icon file loc for user preference based icon
        if (fs.existsSync(fileLoc)) return HTMLFormat ? iconPreview(fileLoc) : fileLoc
        else return HTMLFormat ? iconPreview(path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default.folder : defaultIconJSON.default.folder)) : path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default.folder : defaultIconJSON.default.folder)
    }
}

module.exports = getPreview