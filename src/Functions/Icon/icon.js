const fs = require('fs');
const path = require('path');

const IMAGE = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico'];

const getIcon = async (filename, isDir) => {
    const iconJSON = await fs.readFileSync(path.join(__dirname, "../../config/icon.json"))
    if(isDir){
        // Check if there's a icon for the folder name
        if(Object.keys(JSON.parse(iconJSON).folder).indexOf(filename) !== -1){
            return path.join(__dirname, "../../icon/", JSON.parse(iconJSON).folder[filename])
        }else return path.join(__dirname, "../../icon/", JSON.parse(iconJSON).default.folder)
    }else{
        const ext = filename.split('.').pop(); // Get extension of filename
        if(IMAGE.indexOf(ext) !== -1) return filename // Show the image itself if the file is image
        // Check if there's a icon for the filename name
        if(Object.keys(JSON.parse(iconJSON).extension).indexOf(ext) !== -1){
            return path.join(__dirname, "../../icon/", JSON.parse(iconJSON).extension[ext])
        }else return path.join(__dirname, "../../icon/", JSON.parse(iconJSON).default.file)
    }
}

module.exports = getIcon