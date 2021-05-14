const fs = require('fs');
const path = require('path');
const storage = require('electron-json-storage-sync');
const os = require('os');

const IMAGE = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico'];
const VIDEO = ['mp4', 'webm', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'ocg', 'm4p', 'm4v', 'avi', 'wmv', 'mov', 'qt', 'flv', 'swf'];

// Return image view of preview
const iconPreview = (filename) => {
    return `<img src = "${filename}" class="file-grid-preview" />`
}
// Return video view of preview
const videoPreview =  (filename, iconJSON) => {
    let alt = path.join(__dirname, "../../icon/", iconJSON.extension.video) // Alternative for video if video could not be oaded
    return `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>`
}

const getPreview =  (filename, isDir) => {
    let defaultIconJSON = JSON.parse(fs.readFileSync(path.join(__dirname, "../../config/icon.json")))
    // Get user preference on icon
    const icon  = storage.get('icon')
    let iconJSON = null;
    if(icon.data) iconJSON = JSON.parse(fs.readFileSync(icon.data.iconJSON))
    if(isDir){
        // Check if there's a icon for the folder name
        if(Object.keys(iconJSON.folder).indexOf(filename) !== -1){
            return iconPreview(path.join(__dirname, "../../icon/", iconJSON.folder[filename]))
        }else return iconPreview(path.join(__dirname, "../../icon/", iconJSON.default.folder))
    }else{
        const ext = filename.split('.').pop().toLowerCase() // Get extension of filename
        if(IMAGE.indexOf(ext) !== -1) return iconPreview(filename) // Show the image itself if the file is image
        else if(VIDEO.indexOf(ext) !== -1) return videoPreview(filename, iconJSON) // Show vthe video itself if the file is video
        // Check if there's a icon for the filename name
        if(Object.keys(iconJSON.extension).indexOf(ext) !== -1){
            let fileLoc = iconJSON.extension[ext][0] === "/" ? iconJSON.extension[ext] : path.join(icon.data.iconJSON, '../', iconJSON.extension[ext]) // File loc for user preference based icon
            if(iconJSON && fs.existsSync(fileLoc)) return iconPreview(fileLoc)
            else return iconPreview(path.join(__dirname, "../../icon/", defaultIconJSON.extension[ext]))
        }else{
            let fileLoc = iconJSON.default.file[0] === "/" ? iconJSON.extension[ext] : path.join(icon.data.iconJSON, '../', iconJSON.default.file) // File loc for user preference based icon
            if(iconJSON && fs.existsSync(fileLoc)) return iconPreview(fileLoc)
            else return iconPreview(path.join(__dirname, "../../icon/", iconJSON.default.file))
        }
    }
}

module.exports = getPreview