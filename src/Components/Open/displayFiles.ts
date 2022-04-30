import Storage from '../../Service/storage';
import fileThumbnail from '../Thumbnail/thumbnail';
import formatBytes from '../Functions/filesize';
import type FileMetaData from '../../Typings/fileMetaData';
import { Select } from '../Files/File Operation/select';
import normalizeSlash from '../Functions/path/normalizeSlash';
import joinPath from '../Functions/path/joinPath';
import getDefaultSort from './defaultSort';
import { LnkData } from '../../Typings/fileMetaData';
/**
 * Display files into Xplorer main section
 * @param {fileData[]} files - array of files of a directory
 * @param {string} dir - directory base path
 * @param {HTMLElement} onElement - element to append files element
 * @param {{reveal: boolean, revealDir: boolean}} options - options
 * @param {boolean} isSearch - if true, files are searched
 * @param {LnkData[]} lnk_files - array of lnk files
 *
 * @returns {Promise<HTMLElement>}
 */
const displayFiles = async (
	files: FileMetaData[],
	dir: string,
	onElement?: HTMLElement,
	options?: { reveal: boolean; revealDir: string },
	isSearch?: boolean,
	lnk_files?: LnkData[]
): Promise<HTMLElement> => {
	const FilesElement = onElement ?? document.createElement('div');
	const preference = await Storage.get('preference');
	const appearance = await Storage.get('appearance');
	const dirAlongsideFiles = preference?.dirAlongsideFiles ?? false;
	const layout = (await Storage.get('layout'))?.[dir] ?? appearance?.layout ?? 'd';
	const sort = (await Storage.get('sort'))?.[dir] ?? (await getDefaultSort(dir));
	switch (sort) {
		case 'L': // Last Modified
			files.sort((a, b) => {
				return new Date(a.last_modified?.secs_since_epoch ?? a.time_deleted) < new Date(b.last_modified?.secs_since_epoch ?? b.time_deleted)
					? 1
					: -1;
			});
			break;
		case 'F': // First Modified
			files.sort((a, b) => {
				return new Date(a.last_modified?.secs_since_epoch ?? a.time_deleted) > new Date(b.last_modified?.secs_since_epoch ?? b.time_deleted)
					? 1
					: -1;
			});
			break;
		case 'S': // Size
			files.sort((a, b) => a.size - b.size);
			break;
		case 'T': // Filetype
			files.sort((a, b) => (a.file_type > b.file_type ? 1 : -1));
			break;

		case 'A': // A-Z
		case 'Z': // Z-A
		default: {
			const compator = new Intl.Collator(undefined, {
				numeric: true,
				sensitivity: 'base',
			}).compare;
			if (sort === 'Z') {
				files.sort((a, b) => {
					return compator(b.basename.toLowerCase(), a.basename.toLowerCase());
				});
			} else {
				files.sort((a, b) => {
					return compator(a.basename.toLowerCase(), b.basename.toLowerCase());
				});
			}
		}
	}
	if (!dirAlongsideFiles) {
		files = files.sort((a, b) => -(Number(a.is_dir) - Number(b.is_dir)));
	}

	const imageAsThumbnail =
		(appearance?.imageAsThumbnail ?? 'smalldir') === 'smalldir' ? files.length < 100 : appearance?.imageAsThumbnail === 'yes';
	for (const file of files) {
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
		if (isSearch) displayName = file.file_path;

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
		if (file.is_trash) fileGrid.dataset.realPath = encodeURI(joinPath(file.original_parent, file.basename));
		let preview: string;
		if (file.file_type === 'Windows Shortcut') {
			fileGrid.dataset.isLnk = 'true';
			for (const lnk of lnk_files) {
				if (file.file_path === lnk.file_path) {
					preview = await fileThumbnail(lnk.icon, 'file', true, true);
					break;
				}
			}
		} else {
			preview = await fileThumbnail(file.file_path, file.is_dir ? 'folder' : 'file', true, imageAsThumbnail);
		}

		fileGrid.dataset.path = encodeURI(normalizeSlash(file.file_path));
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
				file.size > 0
					? `<span class="file-size" id="file-size">${formatBytes(
							file.size // eslint-disable-next-line no-mixed-spaces-and-tabs
					  )}</span>`
					: `<span class="file-size" id="file-size"></span>`
			}
            <span class="file-type">${file.file_type}</span>
            `;
		FilesElement.appendChild(fileGrid);
	}
	if (options?.reveal) {
		Select(document.querySelector<HTMLElement>(`.file[data-path="${encodeURI(options?.revealDir)}"]`), false, false);
	}

	return FilesElement;
};

export default displayFiles;
