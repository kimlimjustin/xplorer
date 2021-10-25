import DirectoryAPI, { FileMetaData } from '../../../Api/directory';
import { stopLoading } from '../../Functions/Loading/loading';
import { updateTheme } from '../../Theme/theme';
import LAZY_LOAD from '../../Functions/lazyLoadingImage';
import FileAPI from '../../../Api/files';
import changePosition from '../../Functions/changePosition';
import Home from '../../Layout/home';
import displayFiles from '../../Functions/displayFiles';

/**
 * Open a directory on Xplorer
 * @param {string} dir - Dir path to open
 * @param {boolean} reveal - Open the parent directory and select the file/dir
 * @returns {void}
 */
const OpenDir = (dir: string, reveal?: boolean): void => {
	changePosition(dir);
	const MAIN_ELEMENT = document.getElementById('workspace');
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification'))
		MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist

	if (dir === 'xplorer://Home') {
		Home();
	} else {
		const directoryInfo = new DirectoryAPI(dir);
		directoryInfo.getFiles().then(async (files) => {
			if (!files.files.length) {
				MAIN_ELEMENT.classList.add('empty-dir-notification');
				MAIN_ELEMENT.innerText = 'This folder is empty.';
				stopLoading();
			} else {
				await displayFiles(files.files, dir, MAIN_ELEMENT);
				stopLoading();
				updateTheme();
				LAZY_LOAD();
			}
		});
	}
};
/**
 * Open file/folder handler
 * @param {any} e - event
 * @returns {void}
 */
const OpenHandler = (e: Event): void => {
	let element = e.target as HTMLElement;
	while (!element.dataset.path) {
		element = element.parentNode as HTMLElement;
	}
	if (element.id === 'workspace') return;

	const filePath = unescape(element.dataset.path);

	// Open the file if it's not directory
	if (element.dataset.isdir !== 'true') {
		//openFileWithDefaultApp(filePath)
		new FileAPI(filePath).openFile();
	} else {
		OpenDir(filePath);
	}
};
/**
 * Open directory/file listener initializer
 * @returns {void}
 */
const OpenInit = (): void => {
	document
		.querySelector('#sidebar-nav')
		.addEventListener('click', OpenHandler);
	document
		.querySelector('#workspace')
		.addEventListener('dblclick', OpenHandler);
};
/*import fileThumbnail from "../../Thumbnail/thumbnail";
import Home from '../../Layout/home';
import changePosition from "../../Functions/changePosition";
import { updateTheme } from "../../Theme/theme";
import nativeDrag from "./drag";
import { startLoading, stopLoading } from "../../Functions/Loading/loading";
import Recent from "../../Recent/recent";
import LAZY_LOAD from "../../Functions/lazyLoadingImage";
import formatBytes from "../../Functions/filesize";
import getType from "../File Type/type";
import { SelectListener, Select } from "./select";
import { InfoLog, ErrorLog } from "../../Functions/log";
import { closePreviewFile } from "../File Preview/preview";
import {dialog} from "@electron/remote";
import type fileData from "../../../Typings/fileData";
import { ipcRenderer } from "electron";
import { FSWatcher } from "original-fs";

const WINDOWS_TRASH_FILES_PATH = "C:\\Trash/files";
const WINDOWS_TRASH_INFO_PATH = "C:\\Trash/info";
const LINUX_TRASH_FILES_PATH = path.join(os.homedir(), '.local/share/Trash/files')
const LINUX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info')
const IGNORE_FILE = ['.', '..'];

let timeStarted:number;
let watcher:undefined|FSWatcher;

*/

/**
 * Open a directory on Xplorer
 * @param {string} dir
 * @param {boolean} boolean - Open the parent directory and select the file/dir
 * @returns {void}
 */
/*const open = (dir:string, reveal?:boolean):void => {
    if (!dir) return

    const initialDirToOpen = dir;
    closePreviewFile()
    timeStarted = Date.now()
    startLoading()
    changePosition(dir)
    if (dir === "xplorer://Home") {
        Home(() => {
            SelectListener(document.querySelectorAll(".file"))
            InfoLog(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
            console.log(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`)
        })
    } else if ( dir === "xplorer://Recent") {
        Recent()
    } else if ( dir === "xplorer://Trash") {
        const getFiles = () => {
            if (process.platform === "win32") {
                if (!fs.existsSync(WINDOWS_TRASH_FILES_PATH)) return []
                else {
                    return fs.readdirSync(WINDOWS_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => {
                        const fileInfo = fs.readFileSync(path.join(WINDOWS_TRASH_INFO_PATH, dirent.name + '.trashinfo'), 'utf8').split("\n")
                        let trashPath, trashDeletionDate;
                        if (fileInfo[0] === "[Trash Info]") {
                            trashPath = fileInfo[1].split('=')[1]
                            trashDeletionDate = fileInfo[2].split("=")[1]
                        }
                        const type = getType(unescape(trashPath) ?? path.join(dir, dirent.name), dirent.isDirectory() )
                        return { name: unescape(trashPath), isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)), trashPath, trashDeletionDate, type, isTrash: true, path: unescape(trashPath), realPath: path.join(WINDOWS_TRASH_FILES_PATH, dirent.name) };
                    })
                }
            } else {
                if (!fs.existsSync(LINUX_TRASH_FILES_PATH)) return []
                else {
                    return fs.readdirSync(LINUX_TRASH_FILES_PATH, { withFileTypes: true }).map(dirent => {
                        const fileInfo = fs.readFileSync(path.join(LINUX_TRASH_INFO_PATH, dirent.name + '.trashinfo'), 'utf8').split("\n")
                        let trashPath, trashDeletionDate;
                        if (fileInfo[0] === "[Trash Info]") {
                            trashPath = fileInfo[1].split('=')[1]
                            trashDeletionDate = fileInfo[2].split("=")[1]
                        }
                        const type = getType(unescape(trashPath) ?? path.join(dir, dirent.name), dirent.isDirectory() )

                        return { name: unescape(trashPath), isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)), trashPath, trashDeletionDate, type, isTrash: true, path: unescape(trashPath), realPath: path.join(LINUX_TRASH_FILES_PATH, dirent.name) };
                    })
                }
            }
        }
        const files = getFiles()
        displayFiles(files, process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH)
        // Watch the directory
        watcher?.close()
        fs.watch(process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH, async () => {
            const files = getFiles()
            // Get files of the dir
            displayFiles(files, process.platform === "win32" ? WINDOWS_TRASH_FILES_PATH : LINUX_TRASH_FILES_PATH)
        })

    } else {
        if (!fs.existsSync(dir)) {
            ErrorLog(`${dir} does not exist.`)
            stopLoading()
            if(dialog.showMessageBoxSync({ message: `'${dir}' does not exist. do you want to create it?.`, type: "error", buttons: ["Yes", "No"] }) === 0){
                fs.mkdir(dir, (err) => {
                    if(err) dialog.showMessageBoxSync({message: 'Error creating folder. Please try again', type: "error"})
                })
            } else return;
        }
        if(reveal || !fs.statSync(dir)?.isDirectory()){
            dir = path.dirname(dir)
        }
        const hideSystemFile = storage.get("preference")?.data?.hideSystemFiles ?? true
        let getAttributesSync:any; //eslint-disable-line
        if (process.platform === "win32") getAttributesSync = require("fswin").getAttributesSync; //eslint-disable-line
        const getFiles = () => {
            return fs.readdirSync(dir, { withFileTypes: true }).map(dirent => {
                const result:fileData = { name: dirent.name, isDir: dirent.isDirectory(), isHidden: isHiddenFile(path.join(dir, dirent.name)) }
                const type = getType(path.join(dir, dirent.name), dirent.isDirectory())
                result.type = type
                try {
                    const stat = fs.statSync(path.join(dir, dirent.name))
                    result.createdAt = stat.ctime
                    result.modifiedAt = stat.mtime
                    result.accessedAt = stat.atime
                    result.size = stat.size
                } catch (_) {
                    if (process.platform === "win32" && !hideSystemFile) {
                        const stat = getAttributesSync(path.join(dir, dirent.name));
                        if (stat) {
                            result.createdAt = stat.CREATION_TIME;
                            result.modifiedAt = stat.LAST_WRITE_TIME;
                            result.accessedAt = stat.LAST_ACCESS_TIME;
                            result.size = stat.SIZE;
                        }
                    }
                    result.isSystemFile = true
                }
                return result
            })
        }
        const files = getFiles()
        displayFiles(files, dir, {reveal, initialDirToOpen})
        // Watch the directory
        watcher?.close()
        watcher = fs.watch(dir, async (_, filePath) => {
            // Check if the file is under operation on Xplorer
            if(!ipcRenderer.sendSync('under-operation', path.join(dir, filePath))){
                const files = getFiles()
                // Get files of the dir
                displayFiles(files, dir)
            }
        })
    }
}
   
export { open, openFileWithDefaultApp, closeWatcher }*/
export { OpenInit, OpenDir };
