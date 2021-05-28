const fs = require('fs');
const path = require('path');
const storage = require('electron-json-storage-sync');
const preference = storage.get("preference")?.data

const defaultIconJSON = JSON.parse(fs.readFileSync(path.join(__dirname, "../../config/icon.json")))
let iconJSON = null;
let iconJSONPath = null;

const IMAGE = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico', 'svg', 'webp'];
const VIDEO = ['mp4', 'webm', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'ocg', 'm4p', 'm4v', 'avi', 'wmv', 'mov', 'qt', 'flv', 'swf'];

const DEFAULT_FILE_ICON = path.join(__dirname, "../../icon", defaultIconJSON.default.file)
const DEFAULT_FOLDER_ICON = path.join(__dirname, "../../icon", defaultIconJSON.default.folder)

let DEFAULT_IMAGE = path.join(__dirname, '../../icon', defaultIconJSON.file.image)

// Return image view of preview
const iconPreview = (filename, isdir) => {
    return `<img data-src = "${filename}" class="file-grid-preview" src="${isdir ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'" />`
}
// Return video view of preview
const videoPreview = (filename) => {
    let alt = path.join(iconJSONPath || __dirname, iconJSON ? '../' : '../../icon', iconJSON?.file?.video || defaultIconJSON.file.video) // Alternative for video if video could not be oaded
    if (!fs.existsSync(alt)) alt = path.join(__dirname, '../../icon/', defaultIconJSON.default.file)
    return preference?.autoPlayPreviewVideo ? `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>` : iconPreview(alt)
}

const getPreview = (filename, category = "folder", HTMLFormat = true) => {
    // Get user preference on icon
    const icon = storage.get('icon')

    if (icon.data && fs.existsSync(icon.data.iconJSON)) {
        iconJSON = JSON.parse(fs.readFileSync(icon.data.iconJSON))
        iconJSONPath = icon.data.iconJSON
    }

    const ext = filename.split('.').pop().toLowerCase() // Get extension of filename
    let source = iconJSON || defaultIconJSON

    if (IMAGE.indexOf(ext) !== -1) return HTMLFormat ? iconPreview(filename, isdir = false) : filename // Show the image itself if the file is image
    else if (VIDEO.indexOf(ext) !== -1) return HTMLFormat ? videoPreview(filename) : filename // Show the video itself if the file is video

    filename = filename.toLowerCase() // Lowercase filename

    const folderName = filename.split(/[\\\/]/).pop()

    let categoryObj = category === "file" ? ext : folderName

    if (fs.existsSync(iconJSON?.file?.image)) DEFAULT_IMAGE = path.join(icon?.data?.iconJSON, '../', iconJSON.file.image)

    // Check if there's a icon for the folder name
    if (Object.keys(iconJSON?.[category] || defaultIconJSON[category]).indexOf(categoryObj) !== -1) {
        let fileLoc;
        // Check if category exist in user preference JSON file
        if (category in source) {
            fileLoc = (source?.[category][categoryObj][0] === "/") ? source[category][categoryObj] : path.join(icon?.data?.iconJSON || __dirname, iconJSON ? '../' : '../../icon/', source[category][categoryObj])
        }
        if (fs.existsSync(fileLoc)) return HTMLFormat ? iconPreview(fileLoc, isdir = category === "folder") : fileLoc
        else {
            fileLoc = iconJSON?.default?.[category === "file" ? "file" : "folder"] && fs.existsSync(iconJSON?.default?.[category === "file" ? "file" : "folder"]) ? path.join(iconJSONPath, '../', iconJSON?.default?.[category === "file" ? "file" : "folder"]) : path.join(__dirname, '../../icon/', defaultIconJSON.default[category === "file" ? "file" : "folder"])
            console.log(fileLoc, fs.existsSync(fileLoc))
            return HTMLFormat ? iconPreview(fileLoc, isdir = category === "folder") : fileLoc
        }
    } else {
        let fileLoc;
        // Check if category exist in user preference JSON file
        if ("default" in source) {
            fileLoc = (source.default[category === "file" ? "file" : "folder"][0] === "/") ? source.default[category === "file" ? "file" : "folder"] : path.join(icon?.data?.iconJSON || __dirname, iconJSON ? '../' : '../../icon/', source.default[category === "file" ? "file" : "folder"])
        }
        if (fs.existsSync(fileLoc)) return HTMLFormat ? iconPreview(fileLoc, isdir = category === "folder") : fileLoc
        else return HTMLFormat ? iconPreview(path.join(__dirname, "../../icon/", iconJSON?.default?.[category === "file" ? "file" : "folder"] || defaultIconJSON.default[category === "file" ? "file" : "folder"]), isdir = category === "folder") : path.join(__dirname, "../../icon/", iconJSON?.default?.[category === "file" ? "file" : "folder"] || defaultIconJSON.default[category === "file" ? "file" : "folder"])

    }
}

module.exports = getPreview