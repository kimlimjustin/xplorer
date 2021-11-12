import { OpenLog } from '../Functions/log';
import Storage from '../../Api/storage';
import fileThumbnail from '../Thumbnail/thumbnail';
import formatBytes from '../Functions/filesize';
import type FileMetaData from '../../Typings/fileMetaData';
import { Select } from '../Files/File Operation/select';
import normalizeSlash from '../Functions/path/normalizeSlash';
import joinPath from '../Functions/path/joinPath';
import getDefaultSort from './defaultSort';
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
): Promise<HTMLElement> => {
	const FilesElement = onElement ?? document.createElement('div');
	const preference = await Storage.get('preference');
	const hideSystemFile = preference?.hideSystemFiles ?? true;
	const dirAlongsideFiles = preference?.dirAlongsideFiles ?? false;
	const layout = (await Storage.get('layout'))?.[dir] ?? preference?.layout ?? 'd';
	const sort = (await Storage.get('sort'))?.[dir] ?? (await getDefaultSort(dir)) ?? 'a';

	files = files.sort((a, b) => {
		switch (sort) {
			case 'A': // A-Z
				return a.basename.toLowerCase() > b.basename.toLowerCase() ? 1 : -1;
			case 'Z': // Z-A
				return a.basename.toLowerCase() < b.basename.toLowerCase() ? 1 : -1;
			case 'L': // Last Modified
				return new Date(a.last_modified?.secs_since_epoch ?? a.time_deleted) < new Date(b.last_modified?.secs_since_epoch ?? b.time_deleted)
					? 1
					: -1;
			case 'F': // First Modified
				return new Date(a.last_modified?.secs_since_epoch ?? a.time_deleted) > new Date(b.last_modified?.secs_since_epoch ?? b.time_deleted)
					? 1
					: -1;
			case 'S': // Size
				return a.size > b.size ? 1 : -1;
			case 'T':
				return a.file_type > b.file_type ? 1 : -1;
		}
	});
	if (!dirAlongsideFiles) {
		files = files.sort((a, b) => -(Number(a.is_dir) - Number(b.is_dir)));
	}
	if (hideSystemFile) {
		files = files.filter((file) => !file.is_system);
	}

	const imageAsThumbnail = (preference.imageAsThumbnail ?? 'smalldir') === 'smalldir' ? files.length < 100 : preference.imageAsThumbnail === 'yes';
	for (const file of files) {
		const fileType = file.file_type;
		const preview = await fileThumbnail(file.file_path, file.is_dir ? 'folder' : 'file', true, imageAsThumbnail);
		const fileGrid = document.createElement('div');
		fileGrid.className = 'file-grid grid-hover-effect file';
		let displayName: string;
		switch (layout) {
			case 'm':
				fileGrid.classList.add('medium-grid-view');
				displayName = file.basename.length > 30 ? file.basename.substring(0, 30) + '...' : file.basename;
				break;
			case 'l':
				fileGrid.classList.add('large-grid-view');
				displayName = file.basename.length > 40 ? file.basename.substring(0, 40) + '...' : file.basename;
				break;
			case 'd':
				fileGrid.classList.add('detail-view');
				displayName = file.basename;
				break;
			default:
				fileGrid.classList.add('small-grid-view');
				displayName = file.basename.length > 20 ? file.basename.substring(0, 20) + '...' : file.basename;
				break;
		}

		fileGrid.setAttribute('draggable', 'true');
		if (!file.is_trash) {
			fileGrid.dataset.modifiedAt = String(
				new Date(file.last_modified.secs_since_epoch * 1000).toLocaleString(navigator.language, { hour12: false })
			);
			fileGrid.dataset.createdAt = String(new Date(file.created.secs_since_epoch * 1000).toLocaleString(navigator.language, { hour12: false }));
			fileGrid.dataset.accessedAt = String(
				new Date(file.last_accessed.secs_since_epoch * 1000).toLocaleString(navigator.language, { hour12: false })
			);
		}
		fileGrid.dataset.isdir = String(file.is_dir);
		if (file.time_deleted) fileGrid.dataset.trashDeletionDate = String(file.time_deleted);
		if (file.is_trash) fileGrid.dataset.realPath = escape(joinPath(file.original_parent, file.basename));

		fileGrid.dataset.path = escape(normalizeSlash(file.file_path));
		fileGrid.dataset.isSystem = String(file.is_system);
		fileGrid.dataset.isTrash = String(file.is_trash);
		fileGrid.dataset.isDir = String(file.is_dir);
		fileGrid.dataset.isHidden = String(file.is_hidden);
		fileGrid.dataset.isReadOnly = String(file.readonly);
		fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${displayName}</span>
			${file.original_parent ? `<span class="file-original-parent">${file.original_parent}</span>` : ''}
			<span class="file-modifiedAt" id="file-timestamp">${new Date((file.last_modified?.secs_since_epoch ?? file.time_deleted) * 1000).toLocaleString(
				navigator.language,
				{ hour12: false }
			)}</span>
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
		Select(document.querySelector<HTMLElement>(`.file[data-path="${escape(options?.revealDir)}"]`), false, false);
	}

	OpenLog(dir);
	return FilesElement;
};

export default displayFiles;
