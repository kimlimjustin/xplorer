import fs from "fs";
import path from "path";
import storage from 'electron-json-storage-sync';
import electron from "electron";
import defaultIconData from "./icon.json";
import { extractIcon } from "../../Lib/extracticon/bindings";
interface Icon{
    [key:string]: {
        [key:string]: string
    }
}

let iconJSON:Icon = null;
let iconJSONPath:string = null;
const defaultIconJSON:Icon = defaultIconData;

// Get user preference
const preference = storage.get("preference")?.data
const icon = storage.get('icon')

const IMAGE = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico', 'svg', 'webp'];
const VIDEO = ['mp4', 'webm', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'ocg', 'm4p', 'm4v', 'avi', 'wmv', 'mov', 'qt', 'flv', 'swf'];

const DEFAULT_FILE_ICON = path.join(__dirname, "../../icon", defaultIconJSON.default.file)
const DEFAULT_FOLDER_ICON = path.join(__dirname, "../../icon", defaultIconJSON.default.folder)

let DEFAULT_IMAGE = path.join(__dirname, '../../icon', defaultIconJSON.file.image)

/**
 * Return image view of preview
 * @param {string} filename - the file name
 * @param {boolean} isdir - is it directory?
 * @returns {string} HTML Result
 */
const iconPreview = (filename:string, isdir?:boolean) => {
    return `<img data-src = "${filename}" class="file-grid-preview" src="${isdir ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'" />`
}

/**
 * Return video view of preview
 * @param {string} filename
 * @returns {string} HTML Result
 */
const videoPreview = (filename:string) => {
    const preference = storage.get("preference")?.data
    let alt = path.join(iconJSONPath || __dirname, iconJSON ? '../' : '../../icon', iconJSON?.file?.video || defaultIconJSON.file.video) // Alternative for video if video could not be oaded
    if (!fs.existsSync(alt)) alt = path.join(__dirname, '../../Icon/', defaultIconJSON.default.file)
    return preference?.autoPlayPreviewVideo ? `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>` : iconPreview(alt, false)
}

/**
 * Extract EXE icon and return it as preview
 * @param {string} filename - EXE file name
 * @returns {any} the path of icon extracted from the EXE file
 */
const exePreview = (filename:string) => {
    const basename = filename.split(/[\\/]/)[filename.split(/[\\/]/).length - 1]
    const app = electron.app || (electron.remote && electron.remote.app) || null;
    const EXE_ICON_CACHE_DIR = path.join(app.getPath('userData'), 'Cache/Exe Icon');

    // Create cache directory if not exist
    if (!fs.existsSync(EXE_ICON_CACHE_DIR)) {
        if (!fs.existsSync(path.join(EXE_ICON_CACHE_DIR, '..'))) {
            fs.mkdirSync(path.join(EXE_ICON_CACHE_DIR, '..'))
        }
        fs.mkdirSync(EXE_ICON_CACHE_DIR)
    }
    const ICON_FILE_NAME = path.join(EXE_ICON_CACHE_DIR, basename + '.ico')

    // Cache the icon parsed from the exe
    if (fs.existsSync(ICON_FILE_NAME)) {
        return iconPreview(ICON_FILE_NAME)
    } else {
        const buffer = extractIcon(filename, 'large');
        fs.writeFileSync(ICON_FILE_NAME, buffer);
        return iconPreview(ICON_FILE_NAME)
    }
}

/**
 * Get file icon of a file/folder
 * @param {string} filename - name of the file/folder
 * @param {string} category - category of the file/folder (optional)
 * @param {boolean} HTMLFormat - return with the HTML format (optional)
 * @returns {string} the preview of the file/folder
 */
const fileIcon = (filename:string, category = "folder", HTMLFormat = true):string => {

    if (icon.data && fs.existsSync(icon.data.iconJSON)) {
        iconJSON = JSON.parse(fs.readFileSync(icon.data.iconJSON, 'utf-8'))
        iconJSONPath = icon.data.iconJSON
    }

    const ext = filename.split('.').pop().toLowerCase() // Get extension of filename
    const source = iconJSON || defaultIconJSON

    if (IMAGE.indexOf(ext) !== -1) return HTMLFormat ? iconPreview(filename, false) : filename // Show the image itself if the file is image
    else if (VIDEO.indexOf(ext) !== -1) return HTMLFormat ? videoPreview(filename) : filename // Show the video itself if the file is video

    try {
        if (ext === "exe" && preference?.extractExeIcon !== false && process.platform === "win32") return exePreview(filename)
    // eslint-disable-next-line no-empty
    } catch (_) { }

    filename = filename.toLowerCase() // Lowercase filename

    const folderName = filename.split(/[\\/]/).pop()

    const categoryObj = category === "file" ? ext : folderName

    if (fs.existsSync(iconJSON?.file?.image)) DEFAULT_IMAGE = path.join(icon?.data?.iconJSON, '../', iconJSON.file.image)

    // Check if there's a icon for the folder name
    if (Object.keys(iconJSON?.[category] || defaultIconJSON[category]).indexOf(categoryObj) !== -1) {
        let fileLoc;
        // Check if category exist in user preference JSON file
        if (category in source) {
            fileLoc = (source?.[category][categoryObj][0] === "/") ? source[category][categoryObj] : path.join(icon?.data?.iconJSON || __dirname, iconJSON ? '../' : '../../Icon/', source[category][categoryObj])
        }
        if (fs.existsSync(fileLoc)) return HTMLFormat ? iconPreview(fileLoc, category === "folder") : fileLoc
        else {
            fileLoc = iconJSON?.default?.[category === "file" ? "file" : "folder"] && fs.existsSync(iconJSON?.default?.[category === "file" ? "file" : "folder"]) ? path.join(iconJSONPath, '../', iconJSON?.default?.[category === "file" ? "file" : "folder"]) : path.join(__dirname, '../../icon/', defaultIconJSON.default[category === "file" ? "file" : "folder"])
            console.log(fileLoc, fs.existsSync(fileLoc))
            return HTMLFormat ? iconPreview(fileLoc, category === "folder") : fileLoc
        }
    } else {
        let fileLoc;
        // Check if category exist in user preference JSON file
        if ("default" in source) {
            fileLoc = (source.default[category === "file" ? "file" : "folder"][0] === "/") ? source.default[category === "file" ? "file" : "folder"] : path.join(icon?.data?.iconJSON || __dirname, iconJSON ? '../' : '../../Icon/', source.default[category === "file" ? "file" : "folder"])
        }
        if (fs.existsSync(fileLoc)) return HTMLFormat ? iconPreview(fileLoc, category === "folder") : fileLoc
        else return HTMLFormat ? iconPreview(path.join(__dirname, "../../Icon/", iconJSON?.default?.[category === "file" ? "file" : "folder"] || defaultIconJSON.default[category === "file" ? "file" : "folder"]), category === "folder") : path.join(__dirname, "../../Icon/", iconJSON?.default?.[category === "file" ? "file" : "folder"] || defaultIconJSON.default[category === "file" ? "file" : "folder"])

    }
}

export default fileIcon