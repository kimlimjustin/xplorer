import { OpenLog } from '../Functions/log';
import Storage from '../../Api/storage';
import fileThumbnail from '../Thumbnail/thumbnail';
import formatBytes from '../Functions/filesize';
import getType from '../Files/File Type/type';
import type { FileMetaData } from '../../Api/directory';
import { Select } from '../Files/File Operation/select';
import normalizeSlash from '../Functions/path/normalizeSlash';
/**
 * Display files into Xplorer main section
 * @param {fileData[]} files - array of files of a directory
 * @param {string} dir - directory base path
 * @param {HTMLElement} onElement - element to append files element
 * @returns {Promise<HTMLElement>}
 */
const displayFiles = async (
	files: FileMetaData[],
	dir: string,
	onElement?: HTMLElement,
	options?: { reveal: boolean; revealDir: string }
	//options?: { reveal: boolean; initialDirToOpen: string }
): Promise<HTMLElement> => {
	const FilesElement = onElement ?? document.createElement('div');
	const preference = await Storage.get('preference');
	const hideSystemFile = preference?.hideSystemFiles ?? true;
	const dirAlongsideFiles = preference?.dirAlongsideFiles ?? false;
	const layout =
		(await Storage.get('layout'))?.[dir] ?? preference?.layout ?? 'd';
	const sort = (await Storage.get('sort'))?.[dir] ?? 'A';

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
				return getType(a.basename) > getType(b.basename) ? 1 : -1;
		}
	});
	if (!dirAlongsideFiles) {
		files = files.sort((a, b) => -(Number(a.is_dir) - Number(b.is_dir)));
	}
	if (hideSystemFile) {
		files = files.filter((file) => !file.is_system);
	}

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
			new Date(file.last_modified.secs_since_epoch * 1000).toLocaleString(
				navigator.language,
				{ hour12: false }
			)
		);
		fileGrid.dataset.createdAt = String(
			new Date(file.created.secs_since_epoch * 1000).toLocaleString(
				navigator.language,
				{ hour12: false }
			)
		);
		fileGrid.dataset.accessedAt = String(
			new Date(file.last_accessed.secs_since_epoch * 1000).toLocaleString(
				navigator.language,
				{ hour12: false }
			)
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
		fileGrid.dataset.path = escape(normalizeSlash(file.file_path));
		fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${displayName}</span><span class="file-modifiedAt" id="file-timestamp">${new Date(
			file.last_modified.secs_since_epoch * 1000
		).toLocaleString(navigator.language, { hour12: false })}</span>
            ${
				file.size > 0 && !file.is_dir
					? `<span class="file-size" id="file-size">${formatBytes(
							file.size // eslint-disable-next-line no-mixed-spaces-and-tabs
					  )}</span>`
					: `<span class="file-size" id="file-size"></span>`
			}
            <span class="file-type">${fileType}</span>
            `;
		FilesElement.appendChild(fileGrid);
	}
	if (options?.reveal) {
		Select(
			document.querySelector<HTMLElement>(
				`.file[data-path="${escape(options?.revealDir)}"]`
			),
			false,
			false
		);
	}

	OpenLog(dir);
	return FilesElement;
};

export default displayFiles;
