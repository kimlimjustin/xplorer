import Storage from '../../../Api/storage';
import DirectoryAPI, { FileMetaData } from '../../../Api/directory';
import getType from '../File Type/type';
import { stopLoading } from '../../Functions/Loading/loading';
import { updateTheme } from '../../Theme/theme';
import formatBytes from '../../Functions/filesize';
import LAZY_LOAD from '../../Functions/lazyLoadingImage';
import fileThumbnail from '../../Thumbnail/thumbnail';
import FileAPI from '../../../Api/files';
/**
 * Display files into Xplorer main section
 * @param {fileData[]} files - array of files of a directory
 * @param {string} dir - directory base path
 * @returns {void}
 */
const displayFiles = async (
	files: FileMetaData[],
	dir: string
	//options?: { reveal: boolean; initialDirToOpen: string }
) => {
	const preference = await Storage.get('preference');
	const hideSystemFile = preference?.hideSystemFiles ?? true;
	const dirAlongsideFiles = preference?.dirAlongsideFiles ?? false;
	const layout =
		(await Storage.get('layout'))?.[dir] ?? preference?.layout ?? 's';
	const sort = (await Storage.get('sort'))?.[dir] ?? 'A';
	const MAIN_ELEMENT = document.getElementById('workspace');
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification'))
		MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if

	files = files.sort((a, b) => {
		switch (sort) {
			case 'A': // A-Z
				return a.basename.toLowerCase() > b.basename.toLowerCase()
					? 1
					: -1;
			case 'Z': // Z-A
				return a.basename.toLowerCase() < b.basename.toLowerCase()
					? 1
					: -1;
			case 'L': // Last Modified
				return new Date(a.last_modified.secs_since_epoch) <
					new Date(b.last_modified.secs_since_epoch)
					? 1
					: -1;
			case 'F': // First Modified
				return new Date(a.last_modified.secs_since_epoch) >
					new Date(b.last_modified.secs_since_epoch)
					? 1
					: -1;
			case 'S': // Size
				return a.size > b.size ? 1 : -1;
			case 'T':
				return 1;
			//return getType(a.basename) > getType(b.basename) ? 1 : -1;
		}
	});
	if (!dirAlongsideFiles) {
		files = files.sort((a, b) => -(Number(a.is_dir) - Number(b.is_dir)));
	}
	if (hideSystemFile) {
		files = files.filter((file) => !file.is_system);
	}
	if (!files.length) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = 'This folder is empty.';
		stopLoading();
	} else {
		for (const file of files) {
			const fileType = getType(file.basename, file.is_dir);
			const preview = await fileThumbnail(
				file.file_path,
				file.is_dir ? 'folder' : 'file'
			);
			const fileGrid = document.createElement('div');
			fileGrid.className = 'file-grid grid-hover-effect file';
			//if (dirent.isTrash) fileGrid.dataset.isTrash = 'true';
			let displayName: string;
			switch (layout) {
				case 'm':
					fileGrid.classList.add('medium-grid-view');
					displayName =
						file.basename.length > 30
							? file.basename.substring(0, 30) + '...'
							: file.basename;
					break;
				case 'l':
					fileGrid.classList.add('large-grid-view');
					displayName =
						file.basename.length > 40
							? file.basename.substring(0, 40) + '...'
							: file.basename;
					break;
				case 'd':
					fileGrid.classList.add('detail-view');
					displayName = file.basename;
					break;
				default:
					fileGrid.classList.add('small-grid-view');
					displayName =
						file.basename.length > 20
							? file.basename.substring(0, 20) + '...'
							: file.basename;
					break;
			}
			fileGrid.setAttribute('draggable', 'true');
			fileGrid.dataset.modifiedAt = String(
				new Date(
					file.last_modified.secs_since_epoch * 1000
				).toLocaleString(navigator.language, { hour12: false })
			);
			fileGrid.dataset.createdAt = String(
				new Date(file.created.secs_since_epoch * 1000).toLocaleString(
					navigator.language,
					{ hour12: false }
				)
			);
			fileGrid.dataset.accessedAt = String(
				new Date(
					file.last_accessed.secs_since_epoch * 1000
				).toLocaleString(navigator.language, { hour12: false })
			);
			fileGrid.dataset.isdir = String(file.is_dir);
			/*if (dirent.trashDeletionDate)
                fileGrid.dataset.trashDeletionDate = String(
                    dirent.trashDeletionDate
                );*/
			if (file.is_hidden) fileGrid.dataset.hiddenFile = 'true';
			/*if (dirent.realPath)
                fileGrid.dataset.realPath = escape(
                    dirent.realPath ?? path.join(dir, dirent.name)
                );*/
			fileGrid.dataset.path = escape(file.file_path);
			fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${displayName}</span><span class="file-modifiedAt" id="file-timestamp">${new Date(
				file.last_modified.secs_since_epoch * 1000
			).toLocaleString(navigator.language, { hour12: false })}</span>
            ${
				file.size > 0
					? `<span class="file-size" id="file-size">${formatBytes(
							file.size // eslint-disable-next-line no-mixed-spaces-and-tabs
					  )}</span>`
					: `<span class="file-size" id="file-size"></span>`
			}
            <span class="file-type">${fileType}</span>
            `;
			MAIN_ELEMENT.appendChild(fileGrid);
		}
		/*if (options?.reveal || !fs.statSync(dir)?.isDirectory()) {
			Select(
				document.querySelector<HTMLElement>(
					`[data-path="${escape(options?.initialDirToOpen)}"]`
				),
				false,
				false,
				document.querySelectorAll('.file')
			);
		}*/

		updateTheme();
		LAZY_LOAD();
		/*nativeDrag(document.querySelectorAll('.file'), dir);
		SelectListener(document.querySelectorAll('.file'));

		InfoLog(`Open ${dir} within ${(Date.now() - timeStarted) / 1000}s`);*/
		stopLoading();
		console.timeEnd(dir);
	}
};

/**
 * Open a directory on Xplorer
 * @param {string} dir - Dir path to open
 * @param {boolean} reveal - Open the parent directory and select the file/dir
 * @returns {void}
 */
const OpenDir = (dir: string, reveal?: boolean): void => {
	console.time(dir);
	const directoryInfo = new DirectoryAPI(dir);
	directoryInfo.getFiles().then((files) => {
		displayFiles(files.files, dir);
	});
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
const SYSTEM_FILES = ['desktop.ini'];

let timeStarted:number;
let watcher:undefined|FSWatcher;

document.addEventListener('DOMContentLoaded', () => {
	document.querySelector('#sidebar-nav').addEventListener('click', openFileHandler);
	document.querySelector('#workspace').addEventListener('dblclick', openFileHandler);
})
*/
/**
 * Close dir watcher
 * @returns {void}
 */
/*const closeWatcher = ():void => {
    watcher?.close()
}*/

/**
 * Get command to open a file with default app on various operating systems.
 * @returns {string}
 */
/*const getCommandLine = ():string => {
    switch (process.platform) {
        case 'darwin':
            return 'open';
        default:
            return 'xdg-open';
    }
}
*/
/**
 * Open a file with default app registered
 * @param {string} file path
 * @returns {void}
 */
/*function openFileWithDefaultApp(file:string) :void{
    const child_process = require("child_process"); //eslint-disable-line
    /^win/.test(process.platform) ?
        child_process.exec('start "" "' + file + '"') :
        child_process.spawn(getCommandLine(), [file],
            { detached: true, stdio: 'ignore' }).unref();
            // Push file into recent files
    const recents = storage.get('recent')?.data;
    if (recents) {
        if (recents.indexOf(file) !== -1) {
            recents.push(recents.splice(recents.indexOf(file), 1)[0]);
            storage.set('recent', recents)
        } else {
            storage.set('recent', [...recents, file])
        }
    }
    else storage.set('recent', [file])
}*/

/**
 * Open file handler
 * @param {any} e - event
 * @returns {void}
 */
/*const openFileHandler = (e: Event): void => {

    let element = e.target as HTMLElement;
    while(!element.dataset.path){
        element = element.parentNode as HTMLElement;
    }
    if(element.id === "workspace") return;

    const filePath = unescape(element.dataset.path);

    // Open the file if it's not directory
    if (element.dataset.isdir !== "true") {
        openFileWithDefaultApp(filePath)

    } else {
        open(filePath);
    }
}*/

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
export { OpenInit };
