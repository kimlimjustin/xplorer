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
    if(icon.data && fs.existsSync(icon.data.iconJSON)) iconJSON = JSON.parse(fs.readFileSync(icon.data.iconJSON))
    if(isDir){
        const folderName = filename.split("/").pop()
        // Check if there's a icon for the folder name
        if(Object.keys(iconJSON ? iconJSON.folder : defaultIconJSON.folder).indexOf(folderName) !== -1){
            let fileLoc = iconJSON ? iconJSON.folder[folderName][0] === "/" ? iconJSON.folder[folderName] : path.join(icon.data.iconJSON, '../', iconJSON.folder[folderName]) : defaultIconJSON.folder[folderName][0] === "/" ? defaultIconJSON.folder[folderName] : path.join(__dirname, "../../icon/", defaultIconJSON.folder[folderName]) // Icon file loc for user preference based icon
            if(iconJSON && fs.existsSync(fileLoc)) return iconPreview(fileLoc)
            else return iconPreview(path.join(__dirname, "../../icon/", defaultIconJSON.folder[folderName]))
        }else{
            let fileLoc = iconJSON ? iconJSON.default.folder[0] === "/" ? iconJSON.default.folder : path.join(icon.data.iconJSON, '../', iconJSON.default.folder) : defaultIconJSON.default.folder[0] === "/" ? defaultIconJSON.default.folder : path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default.folder : defaultIconJSON.default.folder)// Icon file loc for user preference based icon
            if(iconJSON && fs.existsSync(fileLoc)) return iconPreview(fileLoc)
            else return iconPreview(path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default.folder : defaultIconJSON.default.folder))
        }
    }else{
        const ext = filename.split('.').pop().toLowerCase() // Get extension of filename
        if(IMAGE.indexOf(ext) !== -1) return iconPreview(filename) // Show the image itself if the file is image
        else if(VIDEO.indexOf(ext) !== -1) return videoPreview(filename, iconJSON ? iconJSON : defaultIconJSON) // Show vthe video itself if the file is video
        // Check if there's a icon for the filename name
        if(Object.keys(iconJSON ? iconJSON.extension : defaultIconJSON.extension).indexOf(ext) !== -1){
            let fileLoc = iconJSON ? iconJSON.extension[ext][0] === "/" ? iconJSON.extension[ext] : path.join(icon.data.iconJSON, '../', iconJSON.extension[ext]) : defaultIconJSON.extension[ext][0] === "/" ? defaultIconJSON.extension[ext] : path.join(__dirname, "../../icon/", defaultIconJSON.extension[ext]) // Icon file loc for user preference based icon
            if(iconJSON && fs.existsSync(fileLoc)) return iconPreview(fileLoc)
            else return iconPreview(path.join(__dirname, "../../icon/", defaultIconJSON.extension[ext]))
        }else{
            let fileLoc = iconJSON ? iconJSON.default.file[0] === "/" ? iconJSON.default.file : path.join(icon.data.iconJSON, '../', iconJSON.default.file) : defaultIconJSON.default.file[0] === "/" ? defaultIconJSON.default.file : path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default.file : defaultIconJSON.default.file)// Icon file loc for user preference based icon
            if(iconJSON && fs.existsSync(fileLoc)) return iconPreview(fileLoc)
            else return iconPreview(path.join(__dirname, "../../icon/", iconJSON ? iconJSON.default.file : defaultIconJSON.default.file))
        }
    }
}

module.exports = getPreview